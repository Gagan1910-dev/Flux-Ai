import FAQ from '../models/FAQ.js';

export const getFAQs = async (req, res) => {
  try {
    const { category, search } = req.query;
    const query = {};

    if (category) {
      query.category = category;
    }

    if (search) {
      query.$text = { $search: search };
    }

    const faqs = await FAQ.find(query)
      .populate('createdBy', 'username')
      .sort({ createdAt: -1 });

    res.json(faqs);
  } catch (error) {
    console.error('Get FAQs error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const createFAQ = async (req, res) => {
  try {
    const { question, answer, category } = req.body;

    if (!question || !answer) {
      return res.status(400).json({ error: 'Question and answer are required' });
    }

    const faq = new FAQ({
      question,
      answer,
      category: category || 'general',
      createdBy: req.user.userId,
    });

    await faq.save();
    await faq.populate('createdBy', 'username');

    res.status(201).json({
      message: 'FAQ created successfully',
      faq,
    });
  } catch (error) {
    console.error('Create FAQ error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const updateFAQ = async (req, res) => {
  try {
    const { id } = req.params;
    const { question, answer, category } = req.body;

    const faq = await FAQ.findById(id);
    if (!faq) {
      return res.status(404).json({ error: 'FAQ not found' });
    }

    if (question) faq.question = question;
    if (answer) faq.answer = answer;
    if (category) faq.category = category;
    faq.updatedAt = new Date();

    await faq.save();
    await faq.populate('createdBy', 'username');

    res.json({
      message: 'FAQ updated successfully',
      faq,
    });
  } catch (error) {
    console.error('Update FAQ error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const deleteFAQ = async (req, res) => {
  try {
    const { id } = req.params;

    const faq = await FAQ.findById(id);
    if (!faq) {
      return res.status(404).json({ error: 'FAQ not found' });
    }

    await FAQ.findByIdAndDelete(id);

    res.json({ message: 'FAQ deleted successfully' });
  } catch (error) {
    console.error('Delete FAQ error:', error);
    res.status(500).json({ error: error.message });
  }
};



