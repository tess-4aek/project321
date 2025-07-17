import express from 'express';

const router = express.Router();

// Predefined email templates for cooperation offers
const emailTemplates = {
  cooperation_basic: {
    name: 'Basic Cooperation Offer',
    subject: 'Partnership Opportunity - Content Collaboration',
    template: `Hello {name},

I hope this email finds you well. I'm reaching out to explore potential partnership opportunities between our organizations.

We specialize in creating high-quality content and are interested in collaborating with your platform. Our team can provide:

• Professional article writing
• SEO-optimized content
• Industry-specific expertise
• Timely delivery

We would love to discuss:
- Your content requirements
- Pricing structure
- Publication guidelines
- Long-term partnership possibilities

Would you be available for a brief call this week to explore how we can work together?

Best regards,
{managerName}`
  },
  
  cooperation_premium: {
    name: 'Premium Partnership Proposal',
    subject: 'Exclusive Content Partnership Proposal',
    template: `Dear {name},

I'm writing to propose an exclusive content partnership that could significantly benefit your platform.

Our content agency has successfully collaborated with leading industry publications, delivering:

✓ Premium, research-backed articles
✓ Engaging multimedia content
✓ SEO optimization for maximum reach
✓ Consistent publishing schedules

Partnership Benefits:
• Exclusive content tailored to your audience
• Competitive pricing for bulk orders
• Priority support and fast turnaround
• Performance tracking and optimization

I'd be delighted to share our portfolio and discuss how we can elevate your content strategy.

Are you available for a 15-minute call this week?

Best regards,
{managerName}`
  },

  follow_up: {
    name: 'Follow-up Template',
    subject: 'Following up on our partnership proposal',
    template: `Hello {name},

I wanted to follow up on my previous email regarding our content partnership proposal.

I understand you're likely busy, but I believe our collaboration could bring significant value to your platform. 

Quick recap of what we offer:
• High-quality, original content
• Flexible pricing options
• Quick turnaround times
• Ongoing support

Would you have just 10 minutes this week for a brief conversation? I'm confident we can find a mutually beneficial arrangement.

Looking forward to hearing from you.

Best regards,
{managerName}`
  }
};

// Get all available templates
router.get('/list', (req, res) => {
  const templateList = Object.keys(emailTemplates).map(key => ({
    id: key,
    name: emailTemplates[key].name,
    subject: emailTemplates[key].subject
  }));

  res.json({
    templates: templateList
  });
});

// Get specific template
router.get('/:templateId', (req, res) => {
  const { templateId } = req.params;
  
  if (!emailTemplates[templateId]) {
    return res.status(404).json({ error: 'Template not found' });
  }

  res.json({
    template: emailTemplates[templateId]
  });
});

// Create custom template (future feature)
router.post('/create', (req, res) => {
  const { name, subject, template, managerEmail } = req.body;

  if (!name || !subject || !template || !managerEmail) {
    return res.status(400).json({ 
      error: 'Name, subject, template content, and manager email are required' 
    });
  }

  // For now, just return success - in production, you'd save to database
  res.json({
    message: 'Custom template creation will be available in future updates',
    template: { name, subject, template }
  });
});

export default router;