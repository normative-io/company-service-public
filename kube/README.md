# Instructions

Follow these instructions to run the API and ScraperService using Kubernetes.

This runs the Docker images in a location of the form _YOUR_ECR_REGISTRY/company-service/api_ and _YOUR_ECR_REGISTRY/company-service/scraper-service_.

NOTE: These instructions use [minikube](https://minikube.sigs.k8s.io/docs/start/) and a Mac (they use `brew`), but they might work with a different setup.

## Pre-requisites

- Install [Docker](https://docs.docker.com/get-docker/)
- Install [minikube](https://minikube.sigs.k8s.io/docs/start/)
- Create and start a minikube cluster with Docker:
  ```
  minikube start --driver=docker
  ```
- Link the `kubectl` command to `minikube`:
  ```
  alias kubectl='minikube kubectl --'
  ```

## Deploy the CompanyService

1.  Set up the following variables:

    ```
    export AWS_DEFAULT_REGION="The aws region of your repo"
    ECR_REGISTRY="Your ECR registry, e.g., 12345.dkr.ecr.REGION.amazonaws.com"
    AWS="The command to access AWS; this can be simply "aws" or a aws-vault command such as "aws-vault exec PROFILE -- aws""
    ```

1.  Authenticate to docker with `docker login`.

    This comand might depend on your setup, but it'll be something like:

    ```
    $AWS ecr get-login-password --region $AWS_DEFAULT_REGION | \
      docker login --username AWS --password-stdin $ECR_REGISTRY
    ```

    You should see "Login Succeeded".

1.  Create a namespace and secrets with the credentials to pull the image from AWS ECR:

    ```
    NAMESPACE_NAME="company-service" && \
    kubectl create namespace ${NAMESPACE_NAME} || true && \
    \
    ECR_REPOSITORY="company-service/api" && \
    kubectl create secret docker-registry company-api-secret \
      --docker-server=${ECR_REGISTRY}/${ECR_REPOSITORY} \
      --docker-username=AWS \
      --docker-password=$($AWS ecr get-login-password) \
      --namespace=${NAMESPACE_NAME} || true && \
    \
    ECR_REPOSITORY="company-service/scraper-service" && \
    kubectl create secret docker-registry scraper-service-secret \
      --docker-server=${ECR_REGISTRY}/${ECR_REPOSITORY} \
      --docker-username=AWS \
      --docker-password=$($AWS ecr get-login-password) \
      --namespace=${NAMESPACE_NAME} || true
    ```

    Notes:

    - The names for the namespace (`company-service`) and the secrets (e.g. `company-api-secret`) come
      from the yaml files.
    - The `...|| true` bash statement is added to ignore errors for already created spaces and
      secrets, so that this same command can be run again without problems.
    - See more information [here](https://skryvets.com/blog/2021/03/15/kubernetes-pull-image-from-private-ecr-registry/).

1.  Start everything:

    ```
    envsubst < kube/api.yaml | kubectl apply -f -
    envsubst < kube/scraper-service.yaml | kubectl apply -f -
    kubectl apply -f kube/mongo.yaml
    ```

1.  Optional: Verify that the components are healthy:

    ```
    kubectl get pods -n company-service
    ```

    The Status should be `Running`, like in this example output:

    ```
    $ kubectl get pods -n company-service
    NAME                               READY   STATUS        RESTARTS   AGE
    company-api-68d894d7d9-nv9mp       1/1     Running       0          15s
    scraper-service-7dc477b69d-wnd7v   1/1     Running       0          15s
    ```

1.  To open the service in a browser (requires minikube) and do your tests:

    ```
    minikube service -n company-service company-service --url
    ```

    This command leaves the terminal window open. You can stop and start the command at any
    point, and all company data should be kept. Copy the printed URL and open it in a browser.

    Tip: remove `--url` to open the service in a browser window directly.

## Deploy Monitoring (Prometheus and Grafana)

### Pre-requisites

Install `helm` and add relevant repos:

```
brew install helm
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
```

Note: we use different charts for prometheus and Grafana. The proposed charts allows for injecting relevant configuration during installation, which reduces the number of clicks afterwards.

### Prometheus

```
helm install prometheus \
  --set alertmanager.enabled=false \
  --set kubeStateMetrics.enabled=false \
  --set nodeExporter.enabled=false \
  --set pushgateway.enabled=false \
  --set server.statefulSet.enabled=true \
  --set-file extraScrapeConfigs=kube/prometheus_configs/extra_scrape_configs.yaml \
prometheus-community/prometheus
```

Note: the line `--set-file extraScrapeConfigs=kube/prometheus_configs/extra_scrape_configs.yaml \` configures prometheus to get metrics from the Company Service components.

### Grafana

```
helm install grafana \
--set grafana.enabled=true \
--set grafana.adminPassword=admin \
--set kubeApiServer.enabled=false \
--set alertmanager.enabled=false \
--set kubelet.enabled=false \
--set kubeControllerManager.enabled=false \
--set coreDns.enabled=false \
--set kubeDns.enabled=false \
--set kubeEtcd.enabled=false \
--set kubeScheduler.enabled=false \
--set kubeProxy.enabled=false \
--set kubeStateMetrics.enabled=false \
--set nodeExporter.enabled=false \
--set prometheusOperator.enabled=false \
--set prometheus.enabled=false \
--set grafana.sidecar.datasources.url=http://prometheus-server:80 \
prometheus-community/kube-prometheus-stack
```

#### Load the CompanyService dashboard

CompanyService provides a Grafana dashboard that you can load:

1. Open Grafana:

   ```
   export POD_NAME=$(kubectl get pods --namespace default -l "app.kubernetes.io/name=grafana,app.kubernetes.io/instance=grafana" -o jsonpath="{.items[0].metadata.name}")
   kubectl --namespace default port-forward $POD_NAME 3000
   ```

1. Open: http://127.0.0.1:3000. Log in with user `admin` and password `admin`.

1. Import the dashboard `kube/grafana_dashboards/company_service.json`.

You should start seeing metrics coming from the Company Service.

### Uninstall

Use these commands to start over.

Prometheus:

```
helm uninstall prometheus
```

Grafana:

```
helm uninstall grafana
```

## Troubleshooting

### There are no metrics in Grafana

- Verify that Prometheus is scraping metrics for `company-api` and `scraper-service`:

  - Run:

    ```
    kubectl --namespace default port-forward prometheus-server-0 9090
    ```

  - Open http://127.0.0.1:9090/targets. You should see entries for `company-api` and `scraper-service`.

  If you don't see the targets, uninstall and install Prometheus again following the steps above. The relevant line is `--set-file extraScrapeConfigs=kube/prometheus_configs/extra_scrape_configs.yaml`.

- Verify that Prometheus is listed as a Datasource in Grafana, and that it is working:

  - Open Grafana (see above), go to `Settings > Datasources`. You should see a `Prometheus` item. Make sure that the URL is `http://prometheus-server:80`, click Test at the bottom to verify.

  - If you don't see `Prometheus`, add it with the above URL. Save and Test.

    TIP: You can confirm that this is the correct address by running `kubectl get svc`.
