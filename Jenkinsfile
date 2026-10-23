pipeline {
  agent any
  options {
    skipDefaultCheckout(true)
    disableConcurrentBuilds()
    timestamps()
    timeout(time: 40, unit: 'MINUTES')
    buildDiscarder(logRotator(numToKeepStr: '10'))
  }
  // SCM polling avoids exposing a webhook endpoint to the internet.
  triggers { pollSCM('H/2 * * * *') }
  parameters {
    string(name: 'DOCKERHUB_USER', defaultValue: 'YOUR_DOCKERHUB_USERNAME', description: 'Your lowercase Docker Hub username')
  }
  environment {
    KUBECONFIG = '/var/lib/jenkins/.kube/config'
  }
  stages {
    stage('Checkout') {
      steps {
        checkout scm
        script {
          if (!(params.DOCKERHUB_USER ==~ /[a-z0-9][a-z0-9_-]*/)) {
            error('Set DOCKERHUB_USER to your lowercase Docker Hub username.')
          }
          env.IMAGE = "${params.DOCKERHUB_USER}/clinixos:${env.BUILD_NUMBER}-${sh(script: 'git rev-parse --short HEAD', returnStdout: true).trim()}"
        }
      }
    }
    stage('Build and Test') {
      steps { sh 'docker build --target checks -t clinixos-checks:$BUILD_NUMBER .' }
    }
    stage('Docker Build') {
      steps { sh 'docker build --target runtime -t "$IMAGE" .' }
    }
    stage('Push Image') {
      steps {
        withCredentials([usernamePassword(credentialsId: 'dockerhub-creds', usernameVariable: 'REGISTRY_USER', passwordVariable: 'REGISTRY_TOKEN')]) {
          sh '''
            set +x
            export DOCKER_CONFIG="$(mktemp -d)"
            trap 'rm -rf "$DOCKER_CONFIG"' EXIT
            printf '%s' "$REGISTRY_TOKEN" | docker login -u "$REGISTRY_USER" --password-stdin
            docker push "$IMAGE"
          '''
        }
      }
    }
    stage('Minikube Deployment') {
      steps {
        sh '''
          kubectl -n clinixos get secret clinixos-secrets >/dev/null
          kubectl -n clinixos apply -f k8s/pvc.yaml
          sed "s|CLINIXOS_IMAGE|$IMAGE|g" k8s/deployment.yaml | kubectl -n clinixos apply -f -
          kubectl -n clinixos apply -f k8s/service.yaml
          kubectl -n clinixos rollout status deployment/clinixos --timeout=300s
        '''
      }
    }
    stage('Verification') {
      steps {
        sh '''
          kubectl -n clinixos get pods,deployments,services,pvc -o wide
          kubectl -n clinixos get deployment clinixos -o jsonpath='{.spec.template.spec.containers[0].image}'
          kubectl -n clinixos exec deployment/clinixos -- node -e "fetch('http://127.0.0.1:5000/api/health').then(async r=>{if(!r.ok)throw Error('HTTP '+r.status);let d=await r.json();if(d.status!=='ONLINE')throw Error('Not online');console.log(d)}).catch(e=>{console.error(e);process.exit(1)})"
          kubectl -n clinixos exec deployment/clinixos -- node -e "fetch('http://clinixos/').then(async r=>{if(!r.ok||!(await r.text()).toLowerCase().includes('<!doctype html>'))throw Error('Frontend Service check failed');console.log('Frontend accessible through Kubernetes Service')}).catch(e=>{console.error(e);process.exit(1)})"
        '''
      }
    }
  }
  post {
    failure {
      sh 'kubectl -n clinixos get pods -o wide || true'
      sh 'kubectl -n clinixos get events --sort-by=.lastTimestamp | tail -20 || true'
      sh 'kubectl -n clinixos logs deployment/clinixos --tail=60 || true'
    }
  }
}
