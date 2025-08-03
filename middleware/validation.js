const validateRegistration = (req, res, next) => {
  const { email, role, name, branch, year, enrollment_no } = req.body;
  if (!email || !role || !name) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }
  if (role === 'student' && (!branch || !year || !enrollment_no)) {
    return res.status(400).json({ success: false, message: 'Branch, year, and enrollment number required for students' });
  }
  const validBranches = ['CSE', 'ECE', 'ME', 'CE'];
  if (role === 'student' && !validBranches.includes(branch)) {
    return res.status(400).json({ success: false, message: 'Invalid branch' });
  }
  if (role === 'student' && (year < 1 || year > 4)) {
    return res.status(400).json({ success: false, message: 'Invalid year' });
  }
  next();
};

const validateLogin = (req, res, next) => {
  const { email, password, role } = req.body;
  if (!email || !password || !role) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }
  next();
};

module.exports = { validateRegistration, validateLogin };