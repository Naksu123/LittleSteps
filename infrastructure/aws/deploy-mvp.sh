#!/usr/bin/env bash
set -euo pipefail

ACTION="${1:-}"
STACK_NAME="${STACK_NAME:-littlesteps-mvp}"
ENV_NAME="${ENV_NAME:-prod}"
AWS_REGION="${AWS_REGION:-ap-southeast-1}"
FRONTEND_ORIGIN="${FRONTEND_ORIGIN:-https://main.example.amplifyapp.com}"
IMAGE_TAG="${IMAGE_TAG:-latest}"

get_output() {
  aws cloudformation describe-stacks \
    --stack-name "${STACK_NAME}" \
    --region "${AWS_REGION}" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue | [0]" \
    --output text
}

case "${ACTION}" in
  deploy-infra)
    : "${DB_PASSWORD:?Set DB_PASSWORD (min 12 chars)}"
    : "${JWT_SECRET_KEY:?Set JWT_SECRET_KEY (min 32 chars)}"
    aws cloudformation deploy \
      --template-file infrastructure/aws/cloudformation-mvp.yaml \
      --stack-name "${STACK_NAME}" \
      --region "${AWS_REGION}" \
      --capabilities CAPABILITY_NAMED_IAM \
      --parameter-overrides \
        "EnvironmentName=${ENV_NAME}" \
        "DBPassword=${DB_PASSWORD}" \
        "JWTSecretKey=${JWT_SECRET_KEY}" \
        "FrontendOrigin=${FRONTEND_ORIGIN}"
    ;;
  push-image)
    ECR_URI="$(get_output ECRRepositoryUri)"
    REGISTRY="${ECR_URI%%/*}"
    aws ecr get-login-password --region "${AWS_REGION}" | docker login --username AWS --password-stdin "${REGISTRY}"
    docker build -t "littlesteps-backend:${IMAGE_TAG}" ./backend
    docker tag "littlesteps-backend:${IMAGE_TAG}" "${ECR_URI}:${IMAGE_TAG}"
    docker push "${ECR_URI}:${IMAGE_TAG}"
    echo "Pushed ${ECR_URI}:${IMAGE_TAG}"
    ;;
  deploy-app)
    : "${DB_PASSWORD:?Set DB_PASSWORD}"
    : "${JWT_SECRET_KEY:?Set JWT_SECRET_KEY}"
    ECR_URI="$(get_output ECRRepositoryUri)"
    aws cloudformation deploy \
      --template-file infrastructure/aws/cloudformation-mvp.yaml \
      --stack-name "${STACK_NAME}" \
      --region "${AWS_REGION}" \
      --capabilities CAPABILITY_NAMED_IAM \
      --parameter-overrides \
        "EnvironmentName=${ENV_NAME}" \
        "DBPassword=${DB_PASSWORD}" \
        "JWTSecretKey=${JWT_SECRET_KEY}" \
        "FrontendOrigin=${FRONTEND_ORIGIN}" \
        "AppRunnerImageUri=${ECR_URI}:${IMAGE_TAG}"
    ;;
  pause)
    SVC_ARN="$(aws apprunner list-services --region "${AWS_REGION}" --query "ServiceSummaryList[?ServiceName=='littlesteps-api-${ENV_NAME}'].ServiceArn | [0]" --output text)"
    if [ -n "${SVC_ARN}" ] && [ "${SVC_ARN}" != "None" ]; then
      aws apprunner pause-service --service-arn "${SVC_ARN}" --region "${AWS_REGION}"
    fi
    aws rds stop-db-instance --db-instance-identifier "littlesteps-db-${ENV_NAME}" --region "${AWS_REGION}"
    ;;
  resume)
    aws rds start-db-instance --db-instance-identifier "littlesteps-db-${ENV_NAME}" --region "${AWS_REGION}"
    SVC_ARN="$(aws apprunner list-services --region "${AWS_REGION}" --query "ServiceSummaryList[?ServiceName=='littlesteps-api-${ENV_NAME}'].ServiceArn | [0]" --output text)"
    if [ -n "${SVC_ARN}" ] && [ "${SVC_ARN}" != "None" ]; then
      aws apprunner resume-service --service-arn "${SVC_ARN}" --region "${AWS_REGION}"
    fi
    ;;
  status)
    aws cloudformation describe-stacks --stack-name "${STACK_NAME}" --region "${AWS_REGION}" --query "Stacks[0].Outputs" --output table
    ;;
  teardown)
    aws cloudformation delete-stack --stack-name "${STACK_NAME}" --region "${AWS_REGION}"
    ;;
  *)
    echo "Usage: $0 {deploy-infra|push-image|deploy-app|pause|resume|status|teardown}" >&2
    exit 1
    ;;
esac
