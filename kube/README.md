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

TODO
