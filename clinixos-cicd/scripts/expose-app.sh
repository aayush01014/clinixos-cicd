#!/usr/bin/env bash
# Run on EC2 after the first successful pipeline.
set -euo pipefail
sudo tee /etc/systemd/system/clinixos-preview.service >/dev/null <<'EOF'
[Unit]
Description=ClinixOS academic demo port forward
After=network-online.target jenkins.service docker.service
Wants=network-online.target
[Service]
User=jenkins
Environment=HOME=/var/lib/jenkins
Environment=KUBECONFIG=/var/lib/jenkins/.kube/config
ExecStart=/usr/local/bin/kubectl -n clinixos port-forward --address=127.0.0.1 service/clinixos 8081:80
Restart=always
RestartSec=5
[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable --now clinixos-preview
echo 'Connect with an SSH tunnel from Windows, then open http://localhost:8081'
