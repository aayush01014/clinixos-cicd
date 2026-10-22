#!/usr/bin/env bash
# Fresh Ubuntu 24.04 x86_64 EC2 instance. Run as: bash scripts/install-aws.sh
set -euo pipefail
sudo apt-get update
sudo apt-get install -y ca-certificates curl git fontconfig openjdk-21-jre
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
sudo tee /etc/apt/sources.list.d/docker.sources >/dev/null <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $(. /etc/os-release && echo "$VERSION_CODENAME")
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF
sudo curl -fsSL https://pkg.jenkins.io/debian-stable/jenkins.io-2026.key -o /etc/apt/keyrings/jenkins-keyring.asc
echo 'deb [signed-by=/etc/apt/keyrings/jenkins-keyring.asc] https://pkg.jenkins.io/debian-stable binary/' | sudo tee /etc/apt/sources.list.d/jenkins.list >/dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin jenkins
sudo usermod -aG docker jenkins
sudo systemctl enable --now docker
sudo systemctl enable jenkins
sudo systemctl restart jenkins
curl -fL https://storage.googleapis.com/minikube/releases/latest/minikube-linux-amd64 -o /tmp/clinixos-minikube
sudo install -m 0755 /tmp/clinixos-minikube /usr/local/bin/minikube
rm /tmp/clinixos-minikube
# Use Minikube's compatible kubectl, under the invoking user's own profile.
sudo tee /usr/local/bin/kubectl >/dev/null <<'EOF'
#!/bin/sh
exec /usr/local/bin/minikube kubectl -- "$@"
EOF
sudo chmod 0755 /usr/local/bin/kubectl
sudo -u jenkins -H docker version
sudo -u jenkins -H minikube start --driver=docker --cpus=2 --memory=3072
sudo -u jenkins -H kubectl get nodes
sudo -u jenkins -H kubectl create namespace clinixos --dry-run=client -o yaml | sudo -u jenkins -H kubectl apply -f -
# Only create the JWT secret once. Do not rotate it on every build.
if ! sudo -u jenkins -H kubectl -n clinixos get secret clinixos-secrets >/dev/null 2>&1; then
  secret_dir=$(mktemp -d)
  trap 'rm -rf "$secret_dir"' EXIT
  openssl rand -hex 32 > "$secret_dir/JWT_SECRET"
  sudo -u jenkins -H kubectl -n clinixos create secret generic clinixos-secrets --from-file=JWT_SECRET=/dev/stdin < "$secret_dir/JWT_SECRET"
fi
echo 'Installation complete. Open Jenkins at http://EC2_PUBLIC_IP:8080'
echo 'Unlock password: sudo cat /var/lib/jenkins/secrets/initialAdminPassword'
