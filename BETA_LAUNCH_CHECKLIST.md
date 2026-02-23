# Beta Launch Checklist

## Before Inviting Testers

### Environment Setup
- [ ] Verify ANTHROPIC_API_KEY is set in Vercel environment variables
- [ ] Verify Supabase connection is working
- [ ] Test login/signup flow with a fresh account
- [ ] Confirm admin account can approve users

### Your Admin Account
- [ ] Confirm your account has `is_admin: true` in Supabase profiles table
- [ ] Test the Admin panel (Shield icon in header)
- [ ] Verify you can approve pending users

### Quick Smoke Test
- [ ] Complete one full assessment end-to-end
- [ ] Verify PDF export works
- [ ] Verify DOCX export works
- [ ] Verify "Copy Report" works
- [ ] Verify Save functionality works
- [ ] Verify scores display correctly in Compass Results

---

## Inviting Beta Testers

### Email Template

**Subject:** Invitation to Beta Test Conscious Compass

Hi [Name],

I'd like to invite you to beta test Conscious Compass, a brand assessment tool we've been developing.

**What it does:**
Evaluates brands across 8 attributes of consciousness using publicly available information from websites, social media, AI reputation, and earned media.

**To get started:**
1. Go to: https://conscious-compass-5g46.vercel.app
2. Click "Create Account" and sign up
3. I'll approve your account within 24 hours
4. See the attached guide for detailed instructions

**Time commitment:**
- First assessment: ~30 minutes
- Subsequent assessments: ~15-20 minutes

**What I'm looking for:**
- Does the scoring feel accurate?
- Are the recommendations relevant?
- What's confusing or friction-filled?
- What's missing?

Please share any feedback via [email/Slack].

Thanks for helping refine this tool!

[Your name]

---

## After Inviting Testers

### Daily Tasks
- [ ] Check Admin panel for pending approvals
- [ ] Approve new users promptly
- [ ] Monitor for any error reports

### Collect Feedback On
- [ ] Scoring accuracy (does it match their intuition?)
- [ ] Recommendation relevance
- [ ] UI/UX friction points
- [ ] Missing inputs or assessment areas
- [ ] Export quality (PDF, DOCX)
- [ ] Time to complete assessments

### Track Issues
| Issue | Reported By | Priority | Status |
|-------|-------------|----------|--------|
| | | | |

---

## Post-Beta Improvements

Based on feedback, typical improvements include:
- Scoring calibration adjustments
- UI clarifications
- Additional input fields
- Export formatting tweaks
- Performance optimizations

---

## Support Escalation

If testers report critical issues:
1. Check Vercel deployment logs
2. Check Supabase logs
3. Test the specific flow yourself
4. Note browser and device if relevant

Common issues:
- **"Pending approval" message**: Approve in Admin panel
- **Scoring fails**: Check API key in Vercel
- **Blank screen**: Usually a browser cache issue (hard refresh)
- **Export fails**: Try different browser
