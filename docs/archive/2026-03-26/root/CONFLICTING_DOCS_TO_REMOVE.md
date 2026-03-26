# Conflicting Documentation - Removal Plan

**Date:** 2026-03-03  
**Purpose:** Identify and remove documentation that conflicts with authoritative references

---

## Category 1: Superseded by VESSEL_ARCHITECTURE_CORRECTED.md

### DEVBOB_VESSEL_ARCHITECTURE.md
**Status:** SUPERSEDED  
**Conflicts:**
- References "becoming" without clear definition
- Focuses on container-level concerns vs activity-centric model
- Dated Feb 24, before architecture clarification

**Action:** Move to historical/2026-02/superseded/  
**Reason:** VESSEL_ARCHITECTURE_CORRECTED.md is now authoritative

---

## Category 2: Superseded by DEPLOYMENT_GUIDE.md

### HELMFILE_DEPLOYMENT_GUIDE.md (301 lines)
**Status:** SUPERSEDED  
**Conflicts:**
- References v1.0.0 specific deployment (outdated)
- Doesn't cover repos/platform/metabob-apps structure
- Missing CI/CD integration
- Missing data persistence section

**Action:** Move to historical/2026-02/superseded/  
**Reason:** DEPLOYMENT_GUIDE.md is comprehensive and current

### DEVBOB_BUILD_DEPLOY.md (394 lines)
**Status:** SUPERSEDED  
**Conflicts:**
- Build-focused, not deployment-focused
- Doesn't use repos/platform/metabob-apps pattern
- Missing environment-specific values pattern

**Action:** Move to historical/2026-02/superseded/  
**Reason:** DEPLOYMENT_GUIDE.md covers this better

### QUICK_DEPLOY.md (87 lines)
**Status:** SUPERSEDED  
**Conflicts:**
- References v1.0.0 deployment (outdated)
- Points to HELMFILE_DEPLOYMENT_GUIDE.md (also superseded)
- Missing current helmfile structure

**Action:** Move to historical/2026-02/superseded/  
**Reason:** DEPLOYMENT_GUIDE.md has quick start section

---

## Category 3: Potentially Conflicting Quick References

### VESSEL_QUICKSTART.md
**Status:** NEEDS REVIEW  
**Issues:**
- May reference old deployment methods
- May not align with repos/platform/metabob-apps

**Action:** Review and update OR move to historical/

### LIBRARY_LEARNING_QUICKSTART.md
**Status:** NEEDS REVIEW  
**Issues:**
- May reference stage progression
- Dated Feb 24, before architecture clarification

**Action:** Review for conflicts with boredom activity model

---

## Summary

**Immediate Removals (High Confidence):**
1. DEVBOB_VESSEL_ARCHITECTURE.md → historical/2026-02/superseded/
2. HELMFILE_DEPLOYMENT_GUIDE.md → historical/2026-02/superseded/
3. DEVBOB_BUILD_DEPLOY.md → historical/2026-02/superseded/
4. QUICK_DEPLOY.md → historical/2026-02/superseded/

**Review Needed:**
1. VESSEL_QUICKSTART.md
2. LIBRARY_LEARNING_QUICKSTART.md

**Total Lines Removed:** ~1,300 lines of potentially conflicting documentation
