# ClinixOS CCA 2: complete setup guide

Follow the numbered steps in order. Commands labelled **Windows** run in PowerShell on your laptop. Commands labelled **EC2** run inside the Ubuntu server. Do not run the EC2 installation script on Windows.

## 1. What is already prepared

Your original archive was inspected. This prepared copy contains the existing React/TypeScript frontend, Express/TypeScript backend, SQLite database code, WebSocket code, and existing tests.

Added: Dockerfile, Jenkinsfile, Kubernetes Deployment/Service/PVC manifests, AWS installation script, and a preview service script. The frontend now uses the same server for `/api` and `/ws`, rather than assuming the backend is on the viewer's laptop. The backend serves the built frontend. SQLite and uploaded files are stored under `/data`, mounted from a Kubernetes volume.

Excluded from this copy: Windows node_modules, existing Git history, generated builds, local database files, uploaded user files, and the old GitHub Pages workflow. Keep your original ZIP separately. Dependencies are reinstalled inside Linux during the Docker build; demo data is seeded without importing the original database.

The source TypeScript checks and 12 existing clinical-engine tests passed during preparation. A full Vite bundle, Linux dependency installation, Docker build, Jenkins run, and AWS/Minikube deployment have NOT been executed in the preparation environment. You will verify them below. Do not present these instructions as evidence that deployment has already succeeded.

## 2. Extract the prepared ZIP on Windows

1. Download `clinixos-cicd-ready.zip`.
2. Right-click it, choose **Extract All**, and extract under a local folder such as `C:\Projects`.
3. Locate the inner `clinixos-cicd` folder. It must directly contain `Dockerfile`, `Jenkinsfile`, `client`, `server`, and `k8s`.
4. Use this prepared folder for the assignment. You do not need to install Node, Docker, or Minikube on Windows for this route.

## 3. Put the extracted source on GitHub

The project files belong in GitHub individually. Do not upload the ZIP as your source repository.

1. Sign in at https://github.com and create a repository called `clinixos-cicd`.
2. A private repository is fine, but requires GitHub credentials in Jenkins. For the simplest academic demo, choose Public only if your team permits publishing this source. This prepared copy excludes the old local database; review remaining project content before publishing.
3. Leave initialization options unchecked if you will push using Git.
4. Install Git for Windows from https://git-scm.com/downloads/win if `git --version` does not work. Reopen PowerShell after installing it.
5. Open the extracted folder in File Explorer. Click the address bar, type `powershell`, and press Enter.
6. Run these **Windows** commands, replacing your GitHub name and email:

```powershell
git config --global user.name "Aayush Potdar"
git config --global user.email "YOUR_GITHUB_EMAIL"
git init
git add .
git status
```

Check that `node_modules`, `.sqlite` databases and `.env` files are absent from the staged list. Then run:

```powershell
git commit -m "Prepare ClinixOS CI/CD assignment"
git branch -M main
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/clinixos-cicd.git
git push -u origin main
```

Complete GitHub's browser sign-in if prompted. Your GitHub account password is not a Git HTTPS password; use browser authentication or a GitHub token when required. Never put a token in the remote URL or source files.

Open your repository page. Confirm `Jenkinsfile` and `Dockerfile` appear directly at the root, alongside `client/`, `server/`, `shared/`, `tests/`, `scripts/` and `k8s/`.

## 4. Create the Docker Hub destination

1. Sign in at https://hub.docker.com (create an account if needed).
2. Create a **public** image repository named `clinixos`. Its image name will be `YOUR_DOCKERHUB_USERNAME/clinixos`.
3. In account settings, create a personal access token that can read and write images. Copy it somewhere private temporarily; later you will enter it in Jenkins credentials.
4. Your Docker Hub username and GitHub username can be different. Use the Docker Hub username in the pipeline parameter.

This guide assumes a public image so Minikube can pull it without an imagePullSecret. A private GitHub source repository can still push a public image. Do not put real patient information or credentials into your image.

## 5. Create an AWS EC2 server

1. Sign in to AWS and open **EC2** in a region available to your account, for example Mumbai.
2. Choose **Launch instance**. Name it `clinixos-jenkins`.
3. Select **Ubuntu Server 24.04 LTS**, **64-bit x86**, not ARM.
4. Use a machine with **2 vCPUs and 8 GiB RAM** for this combined Jenkins/build/Minikube workload; a `t3.large` is one example. A micro instance is too small for this setup. If an instance type is unavailable, choose another x86 instance with at least those resources.
5. Use about **40 GiB gp3** root storage for container layers and cluster data.
6. Create a key pair called `clinixos-key`, select RSA and `.pem`, and download it. Keep the key private and note its exact Windows path.
7. Enable a public IPv4 address and ensure the instance has outbound internet access.
8. Configure inbound security-group rules:

| Port | Source | Purpose |
|---|---|---|
| TCP 22 | My IP | SSH from your laptop |
| TCP 8080 | My IP | Jenkins setup and dashboard |

The app will use an SSH tunnel; you do not need to expose Kubernetes or port 8081 publicly. If your Wi-Fi/public IP changes, update the rules. The PowerShell SSH route below does not depend on browser-based EC2 Instance Connect.

9. Review AWS's displayed charges and any college lab restrictions before launching. This size is not assumed to be free. Stop the instance when finished; stopped instances can still incur storage charges. Delete resources only after the evaluation when you no longer need them.
10. Launch, wait for the status checks to pass, and copy the **Public IPv4 address**.

## 6. Connect from Windows

Open PowerShell and run, replacing both placeholders with your real key location and EC2 IP:

```powershell
ssh -i "C:\Users\YOUR_WINDOWS_USER\Downloads\clinixos-key.pem" ubuntu@EC2_PUBLIC_IP
```

At the first connection, verify the server fingerprint through your AWS connection information before accepting it. You should reach an Ubuntu shell with a prompt containing `ubuntu@...`.

If SSH times out, check instance status, the public IP, and the TCP 22 source rule. If permission is denied, check the key and that the login user is `ubuntu`.

## 7. Copy your source to EC2 and install the tools

For a public repository, run these **EC2** commands:

```bash
sudo apt-get update
sudo apt-get install -y git
git clone https://github.com/YOUR_GITHUB_USERNAME/clinixos-cicd.git
cd clinixos-cicd
bash scripts/install-aws.sh
```

For a private repository, use GitHub HTTPS authentication with an appropriate repository-read token when Git asks for a password, or an SSH deploy key. Do not embed a token in a clone command. This clone under `ubuntu` is used to run the setup scripts; Jenkins will perform its own checkout later.

The script installs Java 21, Jenkins, Docker Engine, Minikube, and a `kubectl` wrapper that uses Minikube's compatible kubectl binary. It starts the cluster as the Linux **jenkins** user, creates namespace `clinixos`, and creates a random JWT signing secret in that namespace.

Important: run Minikube and Kubernetes commands as `jenkins`, exactly as shown. Starting another cluster as `ubuntu` or `root` will give Jenkins a different cluster/configuration.

Wait for the script to finish. Image and dependency downloads can take several minutes. If it fails, fix the displayed error before moving on. You can rerun it on this dedicated fresh server; it preserves an existing JWT secret.

Verify:

```bash
sudo systemctl is-active jenkins
sudo -u jenkins -H docker version
sudo -u jenkins -H minikube status
sudo -u jenkins -H kubectl get nodes
sudo -u jenkins -H kubectl -n clinixos get secret clinixos-secrets
```

Jenkins should be `active`; the node should be `Ready`. Do not print or screenshot secret values.

## 8. Open and configure Jenkins

1. On your Windows browser, open `http://EC2_PUBLIC_IP:8080`.
2. Back in EC2, run:

```bash
sudo cat /var/lib/jenkins/secrets/initialAdminPassword
```

3. Paste that value into Jenkins's unlock screen. Do not put it in your report.
4. Choose **Install suggested plugins** and wait.
5. Create your Jenkins administrator account and finish setup. Set the displayed Jenkins URL to your actual reachable address.
6. Under **Manage Jenkins > Plugins**, ensure **Pipeline**, **Git**, **Credentials Binding**, and **Timestamper** are installed. Restart Jenkins if required. Docker Pipeline and Kubernetes plugins are not needed: this Jenkinsfile calls their command-line tools.
7. Under **Manage Jenkins > Nodes > Built-In Node > Configure**, ensure the dedicated demo server has at least one executor. This example runs on that single server. Do not apply this single-host arrangement to a shared production Jenkins controller.

## 9. Store Docker Hub credentials in Jenkins

1. Open **Manage Jenkins > Credentials > System > Global credentials (unrestricted)**.
2. Choose **Add Credentials**.
3. Kind: **Username with password**.
4. Username: your Docker Hub username.
5. Password: your Docker Hub access token, not a hardcoded value in Jenkinsfile.
6. ID: **`dockerhub-creds`** (exact spelling).
7. Save.

For a private GitHub repository, also add repository-read credentials separately and select them in the pipeline's SCM configuration. Never reuse the Docker Hub credential for GitHub.

## 10. Create the Jenkins pipeline job

1. From the Jenkins dashboard choose **New Item**.
2. Name: `ClinixOS-CICD`; select **Pipeline**, then OK.
3. In the Pipeline section, choose **Pipeline script from SCM**.
4. SCM: **Git**.
5. Repository URL: your GitHub clone URL.
6. Credentials: none for public source; choose your GitHub credential for private source.
7. Branch specifier: **`*/main`**.
8. Script Path: **`Jenkinsfile`**.
9. Save.

The Jenkinsfile defines an automatic source-control poll approximately every two minutes. After the job has read the Jenkinsfile, later source commits trigger builds without clicking Build Now. This avoids opening Jenkins to GitHub webhook traffic.

## 11. Run the first build with your Docker Hub username

On some Jenkins versions, parameters appear only after Jenkins first reads the Jenkinsfile. If **Build with Parameters** is already shown, use it. Otherwise click **Build Now** once; this bootstrap run is expected to stop at the placeholder username check. It is not your successful demonstration run.

1. Open **Build with Parameters**.
2. Set `DOCKERHUB_USER` to your actual lowercase Docker Hub username. Keep the repository part `clinixos` unchanged.
3. Click Build and open the build's **Console Output**.
4. Watch the stages complete:

| Stage | What it does |
|---|---|
| Checkout | Pulls your GitHub source and records the commit |
| Build and Test | Installs Linux dependencies, compiles backend and frontend, and runs the existing 12 clinical tests inside Docker |
| Docker Build | Produces the runtime image with the built website and backend |
| Push Image | Logs in with Jenkins credentials and uploads the uniquely tagged image |
| Minikube Deployment | Applies storage, Deployment and Service, then waits for rollout |
| Verification | Checks Kubernetes resources, API response and frontend through the Service |

Images use tags such as `2-a1b2c3d`: Jenkins build number plus Git commit. Each source change gets a new image reference rather than relying on an ambiguous `latest` tag.

After the first correctly parameterized run, change the default value in `Jenkinsfile` from `YOUR_DOCKERHUB_USERNAME` to your actual username in the Windows project copy, commit and push that change. This keeps automatic polling builds consistent. A username is not a secret. The token remains only in Jenkins credentials.

Wait for **Finished: SUCCESS**. If a stage fails, do not pretend later stages passed. Use the first meaningful error in the console and the troubleshooting section below.

## 12. Verify the deployment on EC2

Run **EC2**:

```bash
sudo -u jenkins -H kubectl -n clinixos get pods,deployments,services,pvc
sudo -u jenkins -H kubectl -n clinixos rollout status deployment/clinixos
sudo -u jenkins -H kubectl -n clinixos logs deployment/clinixos --tail=60
```

Expected: one ready pod, deployment `1/1`, Service `clinixos`, and PVC `Bound`. Startup seeds demo users, doctor profiles, beds and medications into a fresh database. It does not import the old local database and does not recreate all historical patient transactions.

The Deployment uses one replica and `Recreate` because SQLite is being kept on one persistent volume. Redeployment briefly interrupts the demo. The data remains across pod replacements; deleting the PVC or Minikube cluster is different and can remove it.

## 13. Open the actual website on Windows

Minikube's internal IP is not your EC2 public IP. A ClusterIP Service is internal. Use the prepared forwarding service plus an SSH tunnel.

On **EC2**, from the cloned repository:

```bash
bash scripts/expose-app.sh
sudo systemctl status clinixos-preview --no-pager
curl -f http://127.0.0.1:8081/api/health
```

If the forwarder has just started, allow a few seconds and retry curl. The service restarts after a pod replacement so it can follow future rollouts.

Open a SECOND **Windows PowerShell** window and run:

```powershell
ssh -i "C:\Users\YOUR_WINDOWS_USER\Downloads\clinixos-key.pem" -N -L 8081:127.0.0.1:8081 ubuntu@EC2_PUBLIC_IP
```

Leave this window open. A blank waiting terminal is normal. Open these URLs on Windows:

- Website: **http://localhost:8081**
- API: **http://localhost:8081/api/health**

For the NEW demo database created by the seed script:

| Role | Email | Password |
|---|---|---|
| Admin | admin@clinixos.org | ClinixOS@2026 |
| Doctor | doctor.cardio@clinixos.org | ClinixOS@2026 |
| Nurse | nurse@clinixos.org | ClinixOS@2026 |
| Receptionist | receptionist@clinixos.org | ClinixOS@2026 |
| Pharmacist | pharmacist@clinixos.org | ClinixOS@2026 |
| Patient | patient.demo@clinixos.org | ClinixOS@2026 |

These are academic demo accounts from the source seed, not real deployment credentials. The original README listed different passwords; use the table above for this new database. Some workflows need you to create a patient or appointment first.

The browser address is localhost because of the SSH tunnel; the application actually runs in Minikube on EC2. Explain that distinction during the viva. A public URL is not required by this guide; application access and deployment verification are.

## 14. Demonstrate a source-code change and automatic redeployment

1. Take a screenshot of the original footer and record the successful build number and image tag.
2. On **Windows**, open `client/src/App.tsx` in your prepared project folder.
3. Change the visible footer text from `ClinixOS • Intelligent Hospital Operations Platform` to `ClinixOS • CCA 2 Deployment Version 2`.
4. Save and run from the project folder:

```powershell
git add client/src/App.tsx
git commit -m "Show CCA 2 deployment version 2"
git push
```

5. Watch Jenkins. Within its polling interval, the new source commit should start a build automatically. The first polling cycle can establish its baseline; inspect the job's polling log if no build starts.
6. Wait for all stages and **SUCCESS**. Show the new Docker Hub tag and deployment image.
7. Refresh the website after rollout. If a request occurs during replacement, wait for the preview service to reconnect. The new footer proves the browser is seeing the new build.
8. Capture before/after evidence. Do not edit only a README for this demo: use the visible application source change.

Check the deployed image on **EC2**:

```bash
sudo -u jenkins -H kubectl -n clinixos get deployment clinixos -o jsonpath='{.spec.template.spec.containers[0].image}'
```

## 15. Screenshots and submission

Save genuine screenshots as you perform the work. Keep passwords, access tokens, private keys, and secret values out of them.

| Evidence | What should be visible |
|---|---|
| GitHub source | Repository URL and root Dockerfile/Jenkinsfile/k8s folder |
| AWS infrastructure | Running EC2 instance, instance type, Ubuntu setup |
| Jenkins configuration | Pipeline from SCM, branch and Jenkinsfile path |
| Build/test stage | Successful frontend/backend build and 12 passing test output |
| Docker image | Successful image build and push in Jenkins console |
| Docker Hub | Actual pushed tag(s) in your `clinixos` repository |
| Kubernetes | Running/ready pod, deployment, Service, Bound PVC |
| Running app | Website with successful login and a working screen |
| First full run | All pipeline stages successful |
| Second full run | Source change commit, new successful run, and new visible footer |

Submit the GitHub URL, Jenkinsfile, Dockerfile, Kubernetes files, screenshots, and a brief README/report. `README.md` explains the prepared architecture. Add your actual repository URL, AWS setup details, successful build tags and second-run change to it after you perform the work. Do not claim screenshot evidence or live success that you have not obtained.

## 16. Troubleshooting

| Symptom | What to check |
|---|---|
| Jenkins page won't open | Service active, EC2 public IP, port 8080 source = current My IP |
| Docker permission denied | `sudo usermod -aG docker jenkins` then `sudo systemctl restart jenkins`; retry `sudo -u jenkins -H docker version` |
| Pipeline can't find cluster | Cluster started as jenkins; `sudo -u jenkins -H minikube status`; do not copy unrelated root configs |
| `credentialsId` missing | Credential ID is exactly `dockerhub-creds` and its kind is Username with password |
| Image push denied | Token has write permission, username matches, Hub repository named clinixos exists |
| `ImagePullBackOff` | Image repository public, tag pushed, EC2/cluster outbound network; `kubectl describe pod` for exact error |
| `Pending` pod | Inspect pod events, available memory/CPU and PVC binding |
| `CrashLoopBackOff` | Inspect container logs; check JWT secret, filesystem permission and startup errors |
| npm download failure | Outbound HTTPS/DNS on EC2; read actual npm error and retry after resolving connectivity |
| Build killed/OOM | Check available instance memory and disk; don't use a micro instance |
| Website opens but login fails | Use the new seed password; inspect `/api/health`, server logs and browser Network requests |
| `localhost:8081` unavailable | SSH tunnel still running; preview service active; first deployment successful |
| Forwarding fails after rollout | `sudo systemctl restart clinixos-preview`; retry after pod Ready |
| Polling doesn't build | Confirm pollSCM trigger loaded, branch main, valid SCM credentials and saved default Hub username |
| Docker layers fill disk | Inspect `df -h` and `docker system df`; prune unused build cache only when no builds run |

Useful **EC2** diagnostics:

```bash
sudo -u jenkins -H kubectl -n clinixos get events --sort-by=.lastTimestamp
sudo -u jenkins -H kubectl -n clinixos describe deployment clinixos
sudo -u jenkins -H kubectl -n clinixos logs deployment/clinixos --tail=100
sudo journalctl -u clinixos-preview -n 30 --no-pager
```

## 17. Finish your session

1. Close the Windows SSH tunnel with Ctrl+C when done.
2. Stop the EC2 instance if you are not working on it, subject to your college's lab rules. Storage still exists and may cost money.
3. On a later session, start EC2, check its possibly changed public IP, reconnect, run `sudo -u jenkins -H minikube start --driver=docker --cpus=2 --memory=3072` if needed, and restart `clinixos-preview`.
4. Reopen your SSH tunnel using the current public IP. Don't delete Minikube/PVC resources before your evaluation if you need their data.

## Official references

- Jenkins Linux installation: https://www.jenkins.io/doc/book/installing/linux/
- Docker Engine Ubuntu installation: https://docs.docker.com/engine/install/ubuntu/
- Minikube setup and requirements: https://minikube.sigs.k8s.io/docs/start/
- Minikube Docker driver: https://minikube.sigs.k8s.io/docs/drivers/docker/
- Jenkins credentials: https://www.jenkins.io/doc/book/using/using-credentials/
- Jenkins pipeline syntax: https://www.jenkins.io/doc/book/pipeline/syntax/
- AWS EC2 Linux launch tutorial: https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/EC2_GetStarted.html

The single-instance sizing, single-container packaging and SSH preview in this guide are project-specific implementation choices for the academic demo.
