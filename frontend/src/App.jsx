import CustomerPause from "./pages/CustomerPause";
import JoinMess from "./pages/JoinMess";
import CustomerAddress from "./pages/CustomerAddress";
import ChooseFood from "./pages/ChooseFood";
import CustomerCheckout from "./pages/CustomerCheckout";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import Login from "./pages/Login";
import Signup from "./pages/Signup";
import MessDirectory from "./pages/MessDirectory";
import OwnerPublicPage from "./pages/OwnerPublicPage";
import OwnerWorkspace from "./pages/OwnerWorkspace";
import MessPublic from "./pages/MessPublic";
import Explore from "./pages/Explore";
import MyPlans from "./pages/MyPlans";
import Reviews from "./pages/Reviews";
import Payments from "./pages/Payments";
import CustomerMesses from "./pages/CustomerMesses";

import CustomerDashboard
  from "./pages/CustomerDashboard";

import MealHistory
  from "./pages/MealHistory";

import BillHistory
  from "./pages/BillHistory";

import OwnerDashboard
  from "./pages/OwnerDashboard";
import OwnerOnboarding from "./pages/OwnerOnboarding";
import OwnerReviews from "./pages/OwnerReviews";
import KitchenAdvisor from "./pages/KitchenAdvisor";
import ChatWidget from "./components/ChatWidget";

import ManageMeals
  from "./pages/ManageMeals";

import ProtectedRoute
  from "./components/ProtectedRoute";
import LanguageProvider from "./i18n/LanguageProvider";

function App() {
  return (
    <BrowserRouter>
      <LanguageProvider><Routes><Route path="/join/:token" element={<JoinMess />} /><Route path="/mess/:token" element={<MessPublic />} />
        <Route path="/owner/reviews" element={<ProtectedRoute requiredRole="owner"><OwnerReviews /></ProtectedRoute>} />
        <Route path="/owner/messages" element={<Navigate to="/owner" replace />} />
        <Route path="/customer/messages" element={<Navigate to="/customer" replace />} />
        <Route path="/owner/kitchen-advisor" element={<ProtectedRoute requiredRole="owner"><KitchenAdvisor /></ProtectedRoute>} />
        <Route path="/owner/smarter-meals" element={<Navigate to="/owner/kitchen-advisor" replace />} />
        <Route path="/customer/address" element={<ProtectedRoute requiredRole="customer"><CustomerAddress /></ProtectedRoute>} />
        <Route path="/customer/choose" element={<ProtectedRoute requiredRole="customer"><ChooseFood /></ProtectedRoute>} />
        <Route path="/customer/checkout" element={<ProtectedRoute requiredRole="customer"><CustomerCheckout /></ProtectedRoute>} />
        <Route path="/owner/login" element={<Navigate to="/login" replace />} />
        <Route path="/owner/register" element={<Navigate to="/register?role=owner" replace />} />
        <Route path="/register" element={<Signup />} />
        <Route path="/customer/messes" element={<CustomerMesses />} />
        <Route path="/owner/public-page" element={<ProtectedRoute requiredRole="owner"><OwnerPublicPage /></ProtectedRoute>} />
        <Route path="/owner/onboarding" element={<ProtectedRoute requiredRole="owner"><OwnerOnboarding /></ProtectedRoute>} />
        {["requests", "customers", "plans", "bills", "settings"].map(section => <Route key={section} path={`/owner/${section}`} element={<ProtectedRoute requiredRole="owner"><OwnerWorkspace key={section} section={section} /></ProtectedRoute>} />)}
        <Route path="/owner/payments" element={<ProtectedRoute requiredRole="owner"><Payments /></ProtectedRoute>} />
        <Route path="/customer/delivery" element={<Navigate to="/customer" replace />} />
        <Route path="/owner/delivery" element={<Navigate to="/owner" replace />} />
        <Route path="/explore" element={<Explore />} />
        <Route path="/customer/pause" element={<ProtectedRoute requiredRole="customer"><CustomerPause /></ProtectedRoute>} />
        <Route path="/customer/plans/browse" element={<ProtectedRoute requiredRole="customer"><ChooseFood key="subscription-catalog" subscriptionsOnly /></ProtectedRoute>} />
        <Route path="/customer/plans" element={<ProtectedRoute requiredRole="customer"><MyPlans /></ProtectedRoute>} />
        <Route path="/customer/reviews" element={<ProtectedRoute requiredRole="customer"><Reviews /></ProtectedRoute>} />

        <Route
          path="/"
          element={<MessDirectory />}
        />

        <Route
          path="/login"
          element={<Login />}
        />

        <Route
          path="/signup"
          element={<Navigate to="/register" replace />}
        />

        {/* CUSTOMER */}

        <Route
          path="/customer"
          element={
            <ProtectedRoute
              requiredRole="customer"
            >
              <CustomerDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/customer/history"
          element={
            <ProtectedRoute
              requiredRole="customer"
            >
              <MealHistory />
            </ProtectedRoute>
          }
        />

        <Route
          path="/customer/bills"
          element={
            <ProtectedRoute
              requiredRole="customer"
            >
              <BillHistory />
            </ProtectedRoute>
          }
        />

        {/* OWNER */}

        <Route
          path="/owner"
          element={
            <ProtectedRoute
              requiredRole="owner"
            >
              <OwnerDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/owner/meals"
          element={
            <ProtectedRoute
              requiredRole="owner"
            >
              <ManageMeals />
            </ProtectedRoute>
          }
        />

        <Route
          path="*"
          element={
            <Navigate
              to="/login"
              replace
            />
          }
        />

      </Routes><ChatWidget /></LanguageProvider>
    </BrowserRouter>
  );
}

export default App;


