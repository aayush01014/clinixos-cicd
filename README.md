# ClinixOS: CCA 2 CI/CD deployment

ClinixOS is the team's existing hospital-management website. This copy adds an automated Jenkins pipeline for the Cloud Computing and DevOps CCA 2 assignment.

**Start with [SETUP-GUIDE.md](SETUP-GUIDE.md)** for the full Windows, GitHub, AWS, Jenkins and demo walkthrough.

## Architecture

The React/TypeScript frontend is bundled with Vite. The Express/TypeScript backend serves that bundle, REST endpoints and WebSocket connections on port 5000. SQLite stores application data. The frontend uses same-origin paths, so it works when accessed from another computer through a tunnel.

One Docker image contains the frontend and backend. Kubernetes runs one replica with a persistent `/data` volume for SQLite and uploaded files. `Recreate` deployment avoids concurrent SQLite writer pods and briefly interrupts service during rollout. This is an academic single-node Minikube setup.

## Pipeline

1. Checkout source from GitHub.
2. Build the backend and frontend and run 12 existing clinical-engine checks inside a Linux Docker build stage.
3. Build the runtime image.
4. Push to Docker Hub using Jenkins credential `dockerhub-creds` and a build-number/commit tag.
5. Apply Kubernetes PVC, Deployment and Service to namespace `clinixos` and wait for readiness.
6. Verify API health and frontend reachability through the Kubernetes Service.

Jenkins polls SCM approximately every two minutes. After setup and the first run, a source commit triggers the flow automatically. Set the pipeline's `DOCKERHUB_USER` parameter and saved default to your real Docker Hub username. Kubernetes image pulls assume a public `USERNAME/clinixos` repository.

## Files

| Path | Purpose |
|---|---|
| Dockerfile | Multi-stage build, test and non-root runtime |
| Jenkinsfile | Declarative checkout/build/test/push/deploy/verify pipeline |
| k8s/deployment.yaml | Application pod and health probes |
| k8s/service.yaml | Internal HTTP Service |
| k8s/pvc.yaml | Persistent SQLite/upload storage |
| scripts/install-aws.sh | Fresh Ubuntu 24.04 x86 EC2 setup |
| scripts/expose-app.sh | Restarting loopback forwarding service |
| SETUP-GUIDE.md | Complete execution, evidence and troubleshooting steps |

## Jenkins and credentials

The setup installs Java 21, Jenkins and Docker on EC2. Minikube is started as the Linux `jenkins` user so Jenkins and kubectl share the same cluster/configuration. Store a Docker Hub write token only in Jenkins credentials. The installer creates a random Kubernetes JWT secret once; the app requires that secret in production mode.

The deployment enables demo seeding. Its initial admin login is `admin@clinixos.org` / `ClinixOS@2026`. Use only synthetic data; this demonstration configuration is not a hardened production hospital service.

## Build and test

With Docker installed:

```bash
docker build --target checks -t clinixos-checks .
docker build --target runtime -t clinixos-demo .
```

The pipeline runs the existing `tests/clinical_engine.test.ts`, which exits nonzero on failure. The legacy `tests/api.test.ts` is retained but is not claimed as a passing CI suite: it needs a running seeded server, mutates data, and does not reliably return failure exit codes. The clinical tests are algorithm-level checks; they do not establish clinical validity or cover every web workflow. Pipeline verification separately checks API and frontend serving.

For local source development using Node 24, run `npm ci` separately inside `server/` and `client/`. In separate terminals run `npm --prefix server run seed`, then `npm --prefix server run dev`, and `npm --prefix client run dev`. Vite at http://localhost:3000 proxies API and WebSocket traffic to port 5000. The root `npm test` runs the clinical suite.

## Access and redeployment

After successful deployment, the preview service forwards the internal Kubernetes Service to EC2 loopback port 8081. An SSH local tunnel lets the Windows browser open http://localhost:8081 while the application runs on AWS.

For the second demonstration, edit the visible footer in `client/src/App.tsx`, commit and push it, let SCM polling trigger Jenkins, and show the new image tag and updated footer. The PVC retains data across pod replacements.

## Actual execution record

- Deployment date: 23 October 2026.
- GitHub: https://github.com/aayush01014/clinixos-cicd
- Docker Hub: https://hub.docker.com/r/andybones10/clinixos
- AWS: Mumbai (ap-south-1), Ubuntu EC2, m7i-flex.large.
- Instance name: clinixos-jenkins.
- Jenkins, Docker and Minikube run on the EC2 instance.
- First successful pipeline: build #1, image
  andybones10/clinixos:1-b3fe9a6.
- Subsequent commits automatically triggered Jenkins through SCM polling.
- Final theme image published: andybones10/clinixos:4-ec74a8d.

## Source change and redeployment

Updated client/src/index.css to replace the original blue-and-white
appearance with a peach background, teal navigation, orange buttons,
and restyled cards, forms and tables.

After committing to main, Jenkins checked out the updated source,
built and tested the application, built and pushed a new Docker image,
and deployed it to Minikube.

Verification showed a Running pod, an available Deployment, a
Kubernetes Service and bound persistent storage. The application
health endpoint returned ONLINE, and the updated dashboard was
verified in the browser.

## Application access

The Kubernetes Service is forwarded to EC2 loopback port 8081.
An SSH tunnel provides browser access at http://127.0.0.1:8081.
Jenkins is accessed through a separate SSH tunnel at
http://127.0.0.1:18080.

These localhost addresses work while the corresponding SSH tunnels
are open.

## Evidence

Submission screenshots cover the successful pipeline, console result,
Kubernetes resources, original and updated dashboards, published
Docker image, GitHub repository and running AWS instance.
