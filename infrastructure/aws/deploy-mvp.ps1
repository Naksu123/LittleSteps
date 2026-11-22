param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("deploy-infra", "push-image", "deploy-app", "pause", "resume", "status", "teardown")]
  [string]$Action,

  [string]$StackName = "littlesteps-mvp",
  [string]$EnvironmentName = "prod",
  [string]$Region = "ap-southeast-1",
  [string]$DBPassword = "",
  [string]$JWTSecretKey = "",
  [string]$FrontendOrigin = "https://main.example.amplifyapp.com",
  [string]$ImageTag = "latest"
)

$ErrorActionPreference = "Stop"

function Get-StackOutput([string]$OutputKey) {
  aws cloudformation describe-stacks `
    --stack-name $StackName `
    --region $Region `
    --query "Stacks[0].Outputs[?OutputKey=='$OutputKey'].OutputValue | [0]" `
    --output text
}

switch ($Action) {
  "deploy-infra" {
    if (-not $DBPassword -or -not $JWTSecretKey) {
      throw "Provide -DBPassword (min 12 chars) and -JWTSecretKey (min 32 chars) for deploy-infra."
    }
    aws cloudformation deploy `
      --template-file "infrastructure/aws/cloudformation-mvp.yaml" `
      --stack-name $StackName `
      --region $Region `
      --capabilities CAPABILITY_NAMED_IAM `
      --parameter-overrides `
        "EnvironmentName=$EnvironmentName" `
        "DBPassword=$DBPassword" `
        "JWTSecretKey=$JWTSecretKey" `
        "FrontendOrigin=$FrontendOrigin"
  }

  "push-image" {
    $ecrUri = Get-StackOutput "ECRRepositoryUri"
    if (-not $ecrUri -or $ecrUri -eq "None") {
      throw "ECRRepositoryUri output not found. Run deploy-infra first."
    }
    $registry = $ecrUri.Split("/")[0]
    aws ecr get-login-password --region $Region | docker login --username AWS --password-stdin $registry
    docker build -t "littlesteps-backend:$ImageTag" ./backend
    docker tag "littlesteps-backend:$ImageTag" "${ecrUri}:${ImageTag}"
    docker push "${ecrUri}:${ImageTag}"
    Write-Output "Pushed image: ${ecrUri}:${ImageTag}"
  }

  "deploy-app" {
    if (-not $DBPassword -or -not $JWTSecretKey) {
      throw "Provide -DBPassword and -JWTSecretKey when updating stack with AppRunnerImageUri."
    }
    $ecrUri = Get-StackOutput "ECRRepositoryUri"
    aws cloudformation deploy `
      --template-file "infrastructure/aws/cloudformation-mvp.yaml" `
      --stack-name $StackName `
      --region $Region `
      --capabilities CAPABILITY_NAMED_IAM `
      --parameter-overrides `
        "EnvironmentName=$EnvironmentName" `
        "DBPassword=$DBPassword" `
        "JWTSecretKey=$JWTSecretKey" `
        "FrontendOrigin=$FrontendOrigin" `
        "AppRunnerImageUri=${ecrUri}:${ImageTag}"
  }

  "pause" {
    $svcArn = aws apprunner list-services --region $Region --query "ServiceSummaryList[?ServiceName=='littlesteps-api-$EnvironmentName'].ServiceArn | [0]" --output text
    if ($svcArn -and $svcArn -ne "None") {
      aws apprunner pause-service --service-arn $svcArn --region $Region
    }
    aws rds stop-db-instance --db-instance-identifier "littlesteps-db-$EnvironmentName" --region $Region
    Write-Output "Paused App Runner service and stopped RDS instance to minimize demo cost."
  }

  "resume" {
    aws rds start-db-instance --db-instance-identifier "littlesteps-db-$EnvironmentName" --region $Region
    $svcArn = aws apprunner list-services --region $Region --query "ServiceSummaryList[?ServiceName=='littlesteps-api-$EnvironmentName'].ServiceArn | [0]" --output text
    if ($svcArn -and $svcArn -ne "None") {
      aws apprunner resume-service --service-arn $svcArn --region $Region
    }
    Write-Output "Resumed RDS instance and App Runner service."
  }

  "status" {
    aws cloudformation describe-stacks --stack-name $StackName --region $Region --query "Stacks[0].Outputs" --output table
  }

  "teardown" {
    aws cloudformation delete-stack --stack-name $StackName --region $Region
    Write-Output "Requested CloudFormation stack deletion for $StackName (RDS retains a final snapshot)."
  }
}
