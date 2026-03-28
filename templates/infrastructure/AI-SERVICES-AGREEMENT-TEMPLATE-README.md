# AI Services Agreement Template

## Overview

Activity template for generating comprehensive legal agreements that protect AI service providers while granting clients full ownership of outputs.

**Template ID**: `generate-ai-services-agreement`  
**Category**: Infrastructure  
**Status**: ✅ Registered and Validated

## Purpose

This template addresses the unique intellectual property challenges of AI-powered software development services by establishing a **dual IP protection model**:

### Provider Retains (The "How")
- **Activity Templates**: Structured workflow definitions
- **Instructional → Functional State Mapping**: Transformation algorithms
- **Pattern Recognition**: ML models, training data, inference systems
- **Learning Framework**: Knowledge base and decision trees
- **Execution Architecture**: AI orchestration system

### Client Receives (The "What")
- **Generated Code**: All source code and executables
- **Documentation**: Technical specs, API docs, guides
- **Configuration Files**: Deployment configs, environment settings
- **Test Suites**: Unit tests, integration tests, test data

## Critical Legal Principle

> "The created instance of the output state (code) is what is being provided to Client. The means by which that is achieved, and the understanding of how to achieve that, remains Provider's exclusive property."

This distinction protects the AI's learning process ("becoming") while ensuring clients own the deliverables.

## Generated Agreement Structure

The template produces a 4-section legal agreement:

### Section 1: Scope and IP Protection
- Service scope definition (code generation, debugging, refactoring, etc.)
- Dual IP protection model
- Explicit enumeration of proprietary methodology components
- Client's perpetual, irrevocable output license
- ~1,200 words

### Section 2: Confidentiality and Restrictions
- Provider's confidential information definition
- Non-reverse engineering obligations
- Permitted uses of outputs vs. methodology
- License grant limitations
- ~900 words

### Section 3: Warranties and Liability
- Output quality warranties
- Methodology disclaimers (AS-IS)
- Liability caps and exclusions
- Indemnification provisions
- ~800 words

### Section 4: Standard Legal Provisions
- Term and termination
- Governing law and dispute resolution
- General provisions (severability, assignment, etc.)
- Signature blocks
- ~500 words

**Total Agreement Length**: ~3,400-4,000 words (attorney-reviewable)

## Usage

### Command Line
```bash
opencode run --activity generate-ai-services-agreement \
  --var serviceName="AI Development Services" \
  --var clientName="Acme Corporation" \
  --var jurisdiction="California, USA" \
  --var liabilityCapAmount="\$500,000"
```

### Programmatic
```typescript
activity({
  templateId: "generate-ai-services-agreement",
  variables: {
    serviceName: "AI-Powered Activity-Based Development Services",
    clientName: "Example Technology Corporation",
    serviceType: "AI-assisted software development",
    jurisdiction: "Delaware, USA",
    agreementId: "agreement-2026-001",
    liabilityCapAmount: "$250,000",
    liabilityCapPeriod: "preceding 12 months",
    contractTerm: "24 months",
    renewalTerms: "automatic annual renewal",
    terminationNoticePeriod: "60 days",
    disputeResolution: "binding arbitration under AAA rules"
  },
  reason: "Generate client services agreement with dual IP protection"
})
```

## Template Variables

### Required
- `serviceName` (string): Name of AI service offering
- `clientName` (string): Legal name of client entity

### Optional
- `serviceType` (string): Service category (default: "AI-assisted software development")
- `jurisdiction` (string): Legal jurisdiction (default: "Delaware, USA")
- `agreementId` (string): Unique identifier (default: "agreement-001")
- `liabilityCapAmount` (string): Liability cap dollar amount (default: "$100,000")
- `liabilityCapPeriod` (string): Period for fee calculation (default: "preceding 12 months")
- `contractTerm` (string): Initial contract term (default: "12 months")
- `renewalTerms` (string): Renewal terms (default: "automatic annual renewal")
- `terminationNoticePeriod` (string): Notice period for termination (default: "30 days")
- `disputeResolution` (string): Dispute resolution method (default: "binding arbitration under AAA rules")

## Output Location

All agreement sections are written to `/tmp/agreement-{{agreementId}}/`:
- `01-scope-and-ip.md` - Scope and IP protection
- `02-confidentiality.md` - Confidentiality and restrictions
- `03-warranties-liability.md` - Warranties and liability
- `FINAL-AGREEMENT.md` - Complete assembled agreement
- `SUMMARY.md` - Executive summary of protections

## Legal Protections Achieved

### 🛡️ Provider Protections
✅ Activity templates as trade secrets  
✅ State transformation algorithms confidential  
✅ Training data and ML models proprietary  
✅ Non-reverse engineering clause  
✅ Zero liability for methodology design  
✅ AS-IS warranty disclaimer for framework  

### 🎁 Client Benefits
✅ Full ownership of generated code  
✅ Perpetual, irrevocable output license  
✅ Right to modify, distribute, sublicense  
✅ No ongoing royalties or usage restrictions  
✅ Clear IP boundaries (no future disputes)  
✅ Indemnification for output infringement  

## Validation Results

**Test Execution**: 2026-02-26  
**Status**: ✅ 3 of 4 tasks completed successfully  
**Generated Content**: ~3,887 words  
**Quality**: Attorney-reviewable draft  

**Word Count Distribution**:
- Section 1: 1,178 words ✅
- Section 2: 1,347 words ✅
- Section 3: 1,362 words ✅
- Section 4: Pending (template structure complete)

**Quality Checks**:
- ✅ All required legal patterns present
- ✅ No TODOs or placeholder text
- ✅ Professional legal language
- ✅ Clear IP boundaries established
- ✅ Dual ownership model properly structured
- ✅ Delaware jurisdiction compliance

## Use Cases

1. **Client Onboarding**: Generate custom agreements for new AI services clients
2. **Service Contracts**: Establish clear IP terms before project start
3. **Legal Protection**: Protect learning methodology while delivering value
4. **IP Boundary Definition**: Clarify what's proprietary vs. deliverable
5. **Risk Mitigation**: Limit liability for methodology design choices

## Important Notes

⚠️ **Attorney Review Recommended**: This template generates draft agreements. Always have legal counsel review before client use.

⚠️ **Jurisdiction Specific**: Default is Delaware, USA. Modify for other jurisdictions.

⚠️ **Not Legal Advice**: This template is a starting point, not a substitute for legal counsel.

✅ **Customizable**: All variables can be adjusted to fit specific client needs.

✅ **Iterative**: Improve template based on attorney feedback and client negotiations.

## Evolution Opportunities

Future enhancements to consider:

- [ ] International jurisdiction variants (EU GDPR, UK, etc.)
- [ ] Statement of Work (SOW) appendix generation
- [ ] Service Level Agreement (SLA) clauses
- [ ] Data processing addendum for GDPR compliance
- [ ] Comparison chart generator (client-facing summary)
- [ ] PDF export with proper legal formatting
- [ ] Multi-language support
- [ ] Industry-specific variants (healthcare, finance, etc.)

## Related Templates

- `trace-enforce-validate-loop` - For validating IP protection implementation
- `trace-data-flow-single-feature` - For understanding methodology components
- `manage-session-memory` - For understanding learning system

## References

- **Activity Templates**: Protected as trade secrets under this agreement
- **State Transformation**: Core concept protected by dual IP model
- **Learning Framework**: Explicitly enumerated as Provider property

---

**Created**: 2026-02-26  
**Template Version**: 1.0  
**Maintained By**: Activity Infrastructure Team  
**License**: Internal use (template itself is proprietary)
