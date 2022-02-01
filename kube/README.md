# Instructions

## Running in Kubernetes with a remote image (API only)

Follow these instructions to run the API using Kubernetes. This runs the Docker image of the API
in a location of the form _YOUR_ECR_REGISTRY/company-service/api_.

NOTE: These instructions use [minikube](https://minikube.sigs.k8s.io/docs/start/), but they might
work with a different setup.

0.  Pre-requisites:

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

1.  Set up the following variables:

    ```
    export AWS_DEFAULT_REGION="The aws region of your repo"
    ECR_REGISTRY="Your ECR registry, e.g., 12345.dkr.ecr.REGION.amazonaws.com"
    ```

1.  Authenticate to docker with `docker login`.

    This comand might depend on your setup, but it'll be something like:

    ```
    aws ecr get-login-password --region $AWS_DEFAULT_REGION | \
      docker login --username AWS --password-stdin $ECR_REGISTRY
    ```

1.  Replace the placeholders in kube/api.yaml and kube/scraper-service.yaml with the appropriate values.

    You can do this manually by editing those files, or with the following `sed` commands
    (works on a Mac; for Linux, remove ".bak"):

    ```
    sed -i .bak 's/$ECR_REGISTRY/'${ECR_REGISTRY}'/g' kube/api.yaml
    sed -i .bak 's/$ECR_REGISTRY/'${ECR_REGISTRY}'/g' kube/scraper-service.yaml
    ```

1.  Create a namespace and secrets with the credentials to pull the image from AWS ECR:

    ```
    NAMESPACE_NAME="company-service" && \
    kubectl create namespace ${NAMESPACE_NAME} || true && \
    \
    ECR_REPOSITORY="company-service/api" && \
    kubectl create secret docker-registry company-api-secret \
      --docker-server=${ECR_REGISTRY}/${ECR_REPOSITORY} \
      --docker-username=AWS \
      --docker-password=$(aws ecr get-login-password) \
      --namespace=${NAMESPACE_NAME} || true && \
    \
    ECR_REPOSITORY="company-service/scraper-service" && \
    kubectl create secret docker-registry scraper-service-secret \
      --docker-server=${ECR_REGISTRY}/${ECR_REPOSITORY} \
      --docker-username=AWS \
      --docker-password=$(aws ecr get-login-password) \
      --namespace=${NAMESPACE_NAME} || true
    ```

    Notes:

    - The names for the namespace (`company-service`) and the secrets (e.g. `company-api-secret`) come
      from the yaml files.
    - The `...|| true` bash statement is added to ignore errors for already created spaces and
      secrets, so that this same command can be run again without problems.
    - See more information [here](https://skryvets.com/blog/2021/03/15/kubernetes-pull-image-from-private-ecr-registry/).

1.  Start the API and the Scraper Service:

    ```
    kubectl apply -f kube/api.yaml -f kube/scraper-service.yaml
    ```

1.  Test it's all working.

    - Make sure the pods are healthy:

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

    - Open the service in a browser (requires minikube) and do your tests:

      ```
      minikube service -n company-service company-service
      ```

      This command leaves the terminal window open. You can stop and start the command at any
      point, and all company data should be kept.
