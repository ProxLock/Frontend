import { PricingTable } from "@clerk/clerk-react";
import UsageAlert from "../components/UsageAlert";

export default function PricingPage() {
  return (
    <div className="pricing-container">
      <div className="pricing-content">
        <header className="pricing-header">
          <h1 className="pricing-title">Choose Your Plan</h1>
          <p className="pricing-subtitle">
            Select a plan that fits your needs. Upgrade or downgrade at any time.
          </p>
        </header>
        <div className="beta-notice-wrapper">
          <div className="beta-notice">
            <span className="beta-badge">BETA PRICING</span>
            Subscribe now to lock in these rates forever.
          </div>
        </div>
        <UsageAlert />
        <div className="pricing-table-wrapper">
          <PricingTable />
        </div>
      </div>
    </div>
  );
}

