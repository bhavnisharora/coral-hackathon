import express from "express";
import PullRequest from "../models/PullRequest.js";

const router = express.Router();

// POST /api/seed/prs — injects fake PRs for testing the full flow
router.post("/prs", async (req, res) => {
  try {
    await PullRequest.deleteMany({});

    const now = new Date();
    const daysAgo = (d) => new Date(now - d * 24 * 60 * 60 * 1000);

    const fakePRs = [
      {
        prId: 47,
        title: "CORAL-12 refactor promo code validation logic",
        author: "john_doe",
        reviewers: ["jane_smith"],
        repoOwner: "bhavnish",
        repoName: "coral-agent",
        jiraTicket: "CORAL-12",
        jiraStatus: "In Progress",
        filesChanged: ["src/payment/promoService.js", "src/utils/cartHelper.js"],
        diffData: [
          {
            filename: "src/payment/promoService.js",
            patch: `@@ -12,10 +12,14 @@ const applyPromo = (cart, code) => {
-  if (!code) return cart;
-  const discount = getDiscount(code);
-  cart.total = cart.total - discount;
+  const discount = getDiscount(code);
+  if (discount === null) {
+    throw new Error('Invalid promo code');
+  }
+  cart.total = cart.total - discount.value;
+  cart.promoApplied = true;
   return cart;
 };`
          },
          {
            filename: "src/utils/cartHelper.js",
            patch: `@@ -5,6 +5,8 @@ export const calculateTotal = (items) => {
   const subtotal = items.reduce((s, i) => s + i.price, 0);
-  return subtotal;
+  const tax = subtotal * 0.08;
+  return subtotal + tax;
 };`
          }
        ],
        mergedAt: daysAgo(2),
        riskScore: 8,
        aiSummary: "High risk: modifies promo code validation and cart total calculation. Null check removed on discount object."
      },
      {
        prId: 45,
        title: "update user profile avatar upload endpoint",
        author: "jane_smith",
        reviewers: ["john_doe"],
        repoOwner: "bhavnish",
        repoName: "coral-agent",
        jiraTicket: null,
        jiraStatus: null,
        filesChanged: ["src/user/profileController.js"],
        diffData: [
          {
            filename: "src/user/profileController.js",
            patch: `@@ -20,7 +20,9 @@ export const uploadAvatar = async (req, res) => {
-  const url = await s3.upload(req.file);
+  const url = await s3.upload(req.file, { acl: 'public-read' });
+  await User.findByIdAndUpdate(req.user.id, { avatar: url });
   res.json({ url });
 };`
          }
        ],
        mergedAt: daysAgo(4),
        riskScore: 3,
        aiSummary: "Low risk: avatar upload endpoint update, no business logic changes."
      },
      {
        prId: 43,
        title: "CORAL-9 fix session token expiry not refreshing",
        author: "alex_dev",
        reviewers: [],
        repoOwner: "bhavnish",
        repoName: "coral-agent",
        jiraTicket: "CORAL-9",
        jiraStatus: "Done",
        filesChanged: ["src/auth/sessionManager.js", "src/middleware/authMiddleware.js"],
        diffData: [
          {
            filename: "src/auth/sessionManager.js",
            patch: `@@ -8,8 +8,10 @@ export const validateSession = (token) => {
-  const decoded = jwt.verify(token, SECRET);
-  return decoded;
+  const decoded = jwt.verify(token, SECRET, { ignoreExpiration: true });
+  if (Date.now() > decoded.exp * 1000 + 3600000) {
+    throw new Error('Session expired');
+  }
+  return decoded;
 };`
          }
        ],
        mergedAt: daysAgo(5),
        riskScore: 6,
        aiSummary: "Medium risk: session expiry logic changed. ignoreExpiration flag introduced which could allow stale tokens."
      },
      {
        prId: 41,
        title: "add loading skeleton to dashboard cards",
        author: "priya_ui",
        reviewers: ["john_doe"],
        repoOwner: "bhavnish",
        repoName: "coral-agent",
        jiraTicket: null,
        jiraStatus: null,
        filesChanged: ["src/components/DashboardCards.jsx"],
        diffData: [
          {
            filename: "src/components/DashboardCards.jsx",
            patch: `@@ -1,5 +1,12 @@
+import Skeleton from './Skeleton';
+
 const DashboardCards = ({ loading, data }) => {
+  if (loading) return <Skeleton count={4} />;
   return <div>{data.map(c => <Card key={c.id} {...c} />)}</div>;
 };`
          }
        ],
        mergedAt: daysAgo(6),
        riskScore: 1,
        aiSummary: "Very low risk: UI-only change, adds loading skeleton component."
      }
    ];

    await PullRequest.insertMany(fakePRs);
    res.status(201).json({ message: `Seeded ${fakePRs.length} fake PRs`, count: fakePRs.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/seed/prs — wipes all PRs (clean slate for real webhook PRs)
router.delete("/prs", async (req, res) => {
  try {
    await PullRequest.deleteMany({});
    res.status(200).json({ message: "All PRs cleared" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
