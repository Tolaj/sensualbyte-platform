# 🤝 Contributing Guidelines — finanalytics

Thank you for contributing!

---

# 1. Branching Strategy  
We use a lightweight GitFlow model:

Branches:
- main → stable  
- dev → active development  
- feature/<name>  
- bugfix/<description>  

Example:

git checkout dev
git checkout -b feature/bond-duration

---

# 2. Commit Message Rules  
We follow Conventional Commits.

Examples:

feat(time_value): add continuous compounding
fix(cashflow): correct IRR sign-change behavior
docs: update README

Full rules → see docs/COMMIT_RULES.md.

---

# 3. PR Guidelines  
Use this template:

## Description
## Related Issue
## Type of Change
## Testing
## Checklist

---

# 4. Code Style  
- Follow PEP 8  
- Use black for formatting  
- Docstrings for all functions  

---

# 5. Semantic Versioning  
Format: MAJOR.MINOR.PATCH

1.0.0 → initial release  
1.1.0 → new feature  
1.1.1 → bug fix  

---

# 6. Reporting Issues  
Include:
- Title  
- Steps to reproduce  
- Expected vs actual behavior  

---

# 7. Contribution Philosophy  
- Write clean, maintainable code  
- Proper documentation  
- Simple and clear logic  