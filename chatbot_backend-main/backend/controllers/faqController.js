import FAQ from '../models/FAQ.js';

export const getFAQs = async (req, res) => {
  try {
    const { category, search } = req.query;
    const query = {};

    if (typeof category === 'string' && category.trim()) {
      query.category = category.trim().substring(0, 50);
    }

    if (typeof search === 'string' && search.trim()) {
      query.$text = { $search: search.trim().substring(0, 100) };
    }

    const faqs = await FAQ.find(query)
      .populate('createdBy', 'username')
      .sort({ createdAt: -1 })
      .lean();

    res.json(faqs);
  } catch (error) {
    console.error('Get FAQs error:', error.message);
    res.status(500).json({ error: 'Failed to retrieve FAQs' });
  }
};

export const createFAQ = async (req, res) => {
  try {
    const { question, answer, category } = req.body;

    if (typeof question !== 'string' || typeof answer !== 'string') {
      return res.status(400).json({ error: 'Question and answer must be strings' });
    }

    const cleanQuestion = question.trim();
    const cleanAnswer = answer.trim();
    const cleanCategory = typeof category === 'string' ? category.trim().substring(0, 50) : 'general';

    if (!cleanQuestion || !cleanAnswer) {
      return res.status(400).json({ error: 'Question and answer cannot be empty' });
    }

    const faq = new FAQ({
      question: cleanQuestion.substring(0, 500),
      answer: cleanAnswer.substring(0, 2000),
      category: cleanCategory || 'general',
      createdBy: req.user.userId,
    });

    await faq.save();
    await faq.populate('createdBy', 'username');

    res.status(201).json({
      message: 'FAQ created successfully',
      faq,
    });
  } catch (error) {
    console.error('Create FAQ error:', error.message);
    res.status(500).json({ error: 'Failed to create FAQ' });
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

    if (typeof question === 'string' && question.trim()) {
      faq.question = question.trim().substring(0, 500);
    }
    if (typeof answer === 'string' && answer.trim()) {
      faq.answer = answer.trim().substring(0, 2000);
    }
    if (typeof category === 'string' && category.trim()) {
      faq.category = category.trim().substring(0, 50);
    }
    faq.updatedAt = new Date();

    await faq.save();
    await faq.populate('createdBy', 'username');

    res.json({
      message: 'FAQ updated successfully',
      faq,
    });
  } catch (error) {
    console.error('Update FAQ error:', error.message);
    res.status(500).json({ error: 'Failed to update FAQ' });
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
    console.error('Delete FAQ error:', error.message);
    res.status(500).json({ error: 'Failed to delete FAQ' });
  }
};
