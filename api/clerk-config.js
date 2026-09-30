module.exports = (req, res) => {
  const publishableKey =
    process.env.CLERK_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||
    process.env.VITE_CLERK_PUBLISHABLE_KEY ||
    '';
  if (!publishableKey) return res.status(500).json({ error: 'Clerk publishable key is not configured.' });
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ publishableKey });
};
