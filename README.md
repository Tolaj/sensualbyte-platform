# 📘 sensualbyte-platform (MINI CLOUD)

Self-hosted container platform: Cloudflare Tunnel → Nginx Gateway → Dashboard + API → Provisioner → Docker

![License](https://img.shields.io/badge/license-MIT-blue.svg)  
![Python](https://img.shields.io/badge/python-3.9+-blue)  
![Status](https://img.shields.io/badge/status-active-success)

---

## 📄 Documentation

See full documentation and guidelines:

- **Contribution Guidelines** → [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md)
- __Commit Rules__ → [docs/COMMIT_RULES.md](docs/COMMIT_RULES.md)
- __Code of Conduct__ → [docs/CODE_OF_CONDUCT.md](docs/CODE_OF_CONDUCT.md)
- __Bug Report Template__ → [.github/ISSUE_TEMPLATE/bug_report.md](.github/ISSUE_TEMPLATE/bug_report.md)
- __Feature Request Template__ → [.github/ISSUE_TEMPLATE/feature_request.md](.github/ISSUE_TEMPLATE/feature_request.md)
- __Pull Request Template__ → [.github/PULL_REQUEST_TEMPLATE.md](.github/PULL_REQUEST_TEMPLATE.md)

---

## 🚀 Features Overview

### ✔ 1. Time Value of Money (TVM)

- Present Value (PV)
- Future Value (FV)
- Discount Factor
- Effective Annual Rate (EAR)
- Continuous compounding
- Net Present Value (NPV)

---

## 📁 Project Structure

```ini
sensual-platform/
├─ apps/
│  ├─ api/                            
│  │  └─ src/
│  │     ├─ modules/
│  │     │  ├─ auth/
│  │     │  ├─ teams/
│  │     │  ├─ projects/
│  │     │  ├─ rbac/
│  │     │  ├─ catalog/                 
│  │     │  ├─ resources/               
│  │     │  ├─ secrets/                  
│  │     │  ├─ deployments/
│  │     │  ├─ events/                
│  │     │  └─ audit/
│  │     ├─ db/
│  │     ├─ middleware/
│  │     └─ main.ts
│  │
│  └─ dashboard/                      
│
├─ controllers/                         
│  ├─ controller-manager.ts             
│  ├─ kinds/
│  │  ├─ workload.controller.ts       
│  │  ├─ route.controller.ts           
│  │  ├─ bucket.controller.ts           
│  │  ├─ queue.controller.ts            
│  │  ├─ mqtt.controller.ts           
│  │  ├─ log.controller.ts               
│  │  └─ alarm.controller.ts           
│  └─ common/
│     ├─ reconcile.ts
│     └─ status.ts
│
├─ provisioner/                         
│  ├─ docker/
│  │  ├─ client.ts
│  │  ├─ networks.ts
│  │  ├─ containers.ts
│  │  └─ labels.ts                 
│  ├─ secrets/
│  │  ├─ ssh.ts                        
│  │  └─ encrypt.ts                      
│  ├─ adapters/                        
│  │  ├─ minio.ts
│  │  ├─ nats.ts
│  │  ├─ mosquitto.ts
│  │  └─ cron.ts
│  └─ index.ts
│
├─ infra/
│  ├─ nginx/
│  ├─ cloudflared/
│  ├─ docker-compose.prod.yml
│  └─ docker-compose.dev.yml
│
├─ runtime/                              
│  ├─ resources.json                   
│  ├─ routing.json                        
│  ├─ health.json
│  └─ events.log
│
└─ scripts/
   ├─ deploy.sh
   ├─ bootstrap.sh
   └─ migrate.sh


```

---

## 🔧 Installation

### Install setup with default settings

```sh
./scripts/install.sh --yes --defaults
```

### Install setup

```sh
./scripts/install.sh
```

---

# 🎯 Usage Examples

Below are usage samples for each module.  
Full examples available in `examples/demo_examples.py`.

---

# 🧪 Testing

---

# 📦 Build & Distribution

Build distribution:

pip install dist/fincalc-0.1.0-py3-none-any.whl

Install locally:

```sh
pip install dist/fincalc-0.1.0-py3-none-any.whl

```

---

## 🛠 Technologies Used

- Python 3.8+
- NumPy
- Matplotlib

---

# ⭐ Why This Project Is Valuable

Mathematically rigorous yet easy to use — ideal for academic submission or personal finance automation.

---

# 📄 License

MIT License

---

# 🎉 Author

**Swapnil Jadhav | swapnilhgf@gmail.com | www.swapniljadhav.com**
