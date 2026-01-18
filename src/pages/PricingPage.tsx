import { usePlans, useSubscription, CheckoutButton } from '@clerk/clerk-react/experimental';
import UsageAlert from "../components/UsageAlert";

// Plan IDs from Clerk
const PLUS_PLAN_ID = '10k_requests';
const PRO_PLAN_ID = '25k_requests';

// Fallback values if plans fail to load
const FALLBACK_PLANS = {
  plus: {
    name: 'Plus',
    price: '9.99',
    description: 'Get up to 10,000 proxy requests each month and 1 user access key.',
    freeTrialDays: 30,
  },
  pro: {
    name: 'Pro',
    price: '19.99',
    description: 'Get up to 25,000 proxy requests each month and unlimited user access keys.',
    freeTrialDays: 7,
  },
};

const EMAIL_CONTACT = 'mailto:contact@proxlock.com';

export default function PricingPage() {
  const { data: plans, isLoading } = usePlans({ for: 'user' });
  const { data: subscription, isLoading: isLoadingSubscription } = useSubscription({ for: 'user' });

  // Find Free, Plus and Pro plans from Clerk data (check both id and slug)
  const freePlan = plans?.find(plan => plan.slug === 'free' || plan.id === 'free' || plan.name?.toLowerCase() === 'free');
  const plusPlan = plans?.find(plan => plan.id === PLUS_PLAN_ID || plan.slug === PLUS_PLAN_ID);
  const proPlan = plans?.find(plan => plan.id === PRO_PLAN_ID || plan.slug === PRO_PLAN_ID);

  // Determine user's current plan
  const currentPlanId = subscription?.subscriptionItems?.[0]?.plan?.id ?? null;
  const isOnFreePlan = !subscription || !currentPlanId;
  const isOnPlusPlan = currentPlanId === PLUS_PLAN_ID || currentPlanId === plusPlan?.id;
  const isOnProPlan = currentPlanId === PRO_PLAN_ID || currentPlanId === proPlan?.id;

  // Use Clerk data or fallback values
  const plusPrice = plusPlan?.fee?.amountFormatted ?? FALLBACK_PLANS.plus.price;
  const plusDescription = plusPlan?.description ?? FALLBACK_PLANS.plus.description;
  const plusFreeTrialDays = plusPlan?.freeTrialDays ?? FALLBACK_PLANS.plus.freeTrialDays;

  const proPrice = proPlan?.fee?.amountFormatted ?? FALLBACK_PLANS.pro.price;
  const proDescription = proPlan?.description ?? FALLBACK_PLANS.pro.description;
  const proFreeTrialDays = proPlan?.freeTrialDays ?? FALLBACK_PLANS.pro.freeTrialDays;

  const handleSelectPlan = (planId: string) => {
    // Navigate to subscription management or checkout
    // For now, this uses the Subscription component's changeToModal
    window.location.href = `/subscription?plan=${planId}`;
  };

  // Helper to render plan button
  const renderPlanButton = (
    planId: string | undefined,
    isCurrentPlan: boolean,
    isPrimary: boolean,
    buttonText: string,
    isTableBtn?: boolean
  ) => {
    const btnClass = isTableBtn
      ? `btn ${isPrimary ? 'btn-primary' : 'btn-secondary'} table-btn`
      : `btn ${isPrimary ? 'btn-primary' : 'btn-secondary'} plan-btn`;

    if (isCurrentPlan) {
      return (
        <button className={btnClass} disabled>
          Current Plan
        </button>
      );
    }

    if (planId) {
      return (
        <CheckoutButton planId={planId} planPeriod="month">
          <button className={btnClass}>
            {buttonText}
          </button>
        </CheckoutButton>
      );
    }

    return (
      <button
        className={btnClass}
        onClick={() => handleSelectPlan(planId || '')}
      >
        {buttonText}
      </button>
    );
  };

  return (
    <div className="pricing-page-container">
      <div className="pricing-page-content">
        <h1 className="pricing-page-title">Simple Pricing</h1>
        <p className="pricing-page-subtitle">Choose the plan that fits your needs.</p>

        <div className="beta-notice-wrapper">
          <div className="beta-notice">
            <span className="beta-notice-top">
              <span className="beta-badge">Special Pricing</span>
              <span>for <strong>CruzHacks</strong>.</span>
            </span>
            <span className="beta-notice-bottom">Get a {plusFreeTrialDays}-day free trial for new Plus subscribers</span>
          </div>
        </div>

        <UsageAlert />

        <div className="pricing-grid">
          {/* Free Plan */}
          <div className="pricing-card">
            <h3 className="plan-name">Free</h3>
            <div className="plan-price">
              <span className="currency">$</span>0
            </div>
            <p className="plan-billing">Always free</p>
            <p className="plan-description">Get up to 3,000 proxy requests each month.</p>
            {isOnFreePlan ? (
              <button className="btn btn-secondary plan-btn" disabled>
                Current Plan
              </button>
            ) : freePlan?.id ? (
              <CheckoutButton planId={freePlan.id} planPeriod="month">
                <button className="btn btn-secondary plan-btn">
                  Downgrade to Free
                </button>
              </CheckoutButton>
            ) : (
              <button
                className="btn btn-secondary plan-btn"
                onClick={() => window.location.href = '/subscription'}
              >
                Downgrade to Free
              </button>
            )}
          </div>

          {/* Plus Plan */}
          <div className={`pricing-card featured ${isLoading || isLoadingSubscription ? 'loading' : ''}`}>
            <h3 className="plan-name">{plusPlan?.name ?? FALLBACK_PLANS.plus.name}</h3>
            <div className="plan-price">
              <span className="currency">$</span>{plusPrice}
              <span className="period">/month</span>
            </div>
            <p className="plan-billing">Only billed monthly</p>
            <p className="plan-description">{plusDescription}</p>
            {renderPlanButton(
              plusPlan?.id || PLUS_PLAN_ID,
              isOnPlusPlan,
              true,
              isOnFreePlan
                ? `Start ${plusFreeTrialDays} Day Special Free Trial`
                : isOnProPlan
                  ? 'Downgrade to Plus'
                  : 'Switch to Plus'
            )}
          </div>

          {/* Pro Plan */}
          <div className={`pricing-card ${isLoading || isLoadingSubscription ? 'loading' : ''}`}>
            <h3 className="plan-name">{proPlan?.name ?? FALLBACK_PLANS.pro.name}</h3>
            <div className="plan-price">
              <span className="currency">$</span>{proPrice}
              <span className="period">/month</span>
            </div>
            <p className="plan-billing">Only billed monthly</p>
            <p className="plan-description">{proDescription}</p>
            {renderPlanButton(
              proPlan?.id || PRO_PLAN_ID,
              isOnProPlan,
              false,
              isOnFreePlan
                ? `Start ${proFreeTrialDays} Day Free Trial`
                : isOnPlusPlan
                  ? 'Upgrade to Pro'
                  : 'Switch to Pro'
            )}
          </div>

          {/* Enterprise Plan */}
          <div className="pricing-card full-width">
            <div className="plan-header-group">
              <h3 className="plan-name">Enterprise</h3>
              <div className="plan-price">
                Custom
              </div>
            </div>
            <p className="plan-billing">Contact us for details</p>
            <p className="plan-description">Need higher limits? Get in touch for a custom plan.</p>
            <a href={EMAIL_CONTACT} className="btn btn-secondary plan-btn">Contact Us</a>
          </div>
        </div>

        {/* Features Comparison Table */}
        {(plusPlan?.features?.length || proPlan?.features?.length) && (
          <div className="features-table-section">
            <h2 className="features-table-title">Compare Features</h2>
            <div className="features-table-wrapper">
              <table className="features-table">
                <thead>
                  <tr>
                    <th>Feature</th>
                    <th>Free</th>
                    <th className="featured-column">Plus</th>
                    <th>Pro</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Collect all unique features from Plus and Pro plans */}
                  {(() => {
                    // Pattern matchers for consolidated rows
                    const requestsPattern = /requests?/i;
                    const accessKeysPattern = /access\s*key/i;

                    // Helper to extract numeric value from feature name
                    const extractValue = (name: string): string => {
                      // Try to extract number with commas (e.g., "10,000")
                      const numMatch = name.match(/[\d,]+/);
                      if (numMatch) return numMatch[0];
                      // Check for "unlimited"
                      if (/unlimited/i.test(name)) return 'Unlimited';
                      return name;
                    };

                    // Find consolidated features
                    const plusRequestsFeature = plusPlan?.features?.find(f => requestsPattern.test(f.name));
                    const proRequestsFeature = proPlan?.features?.find(f => requestsPattern.test(f.name));
                    const plusAccessKeysFeature = plusPlan?.features?.find(f => accessKeysPattern.test(f.name));
                    const proAccessKeysFeature = proPlan?.features?.find(f => accessKeysPattern.test(f.name));

                    // Build consolidated rows
                    type FeatureRow = { id: string; label: string; freeValue: string; plusValue: string; proValue: string; isConsolidated: boolean };
                    const rows: FeatureRow[] = [];

                    // Monthly Requests row
                    if (plusRequestsFeature || proRequestsFeature) {
                      rows.push({
                        id: 'monthly-requests',
                        label: 'Monthly Requests',
                        freeValue: '3,000',
                        plusValue: plusRequestsFeature ? extractValue(plusRequestsFeature.name) : '—',
                        proValue: proRequestsFeature ? extractValue(proRequestsFeature.name) : '—',
                        isConsolidated: true,
                      });
                    }

                    // Access Keys row
                    if (plusAccessKeysFeature || proAccessKeysFeature) {
                      rows.push({
                        id: 'access-keys',
                        label: 'Access Keys',
                        freeValue: '—',
                        plusValue: plusAccessKeysFeature ? extractValue(plusAccessKeysFeature.name) : '—',
                        proValue: proAccessKeysFeature ? extractValue(proAccessKeysFeature.name) : '—',
                        isConsolidated: true,
                      });
                    }

                    // Add remaining features (not matching consolidated patterns)
                    const consolidatedIds = new Set([
                      plusRequestsFeature?.id,
                      proRequestsFeature?.id,
                      plusAccessKeysFeature?.id,
                      proAccessKeysFeature?.id,
                    ].filter(Boolean));

                    const otherFeatures = new Map<string, { name: string; inPlus: boolean; inPro: boolean }>();

                    plusPlan?.features?.forEach(f => {
                      if (!consolidatedIds.has(f.id)) {
                        otherFeatures.set(f.id, { name: f.name, inPlus: true, inPro: false });
                      }
                    });

                    proPlan?.features?.forEach(f => {
                      if (!consolidatedIds.has(f.id)) {
                        const existing = otherFeatures.get(f.id);
                        if (existing) {
                          existing.inPro = true;
                        } else {
                          otherFeatures.set(f.id, { name: f.name, inPlus: false, inPro: true });
                        }
                      }
                    });

                    // Add other features as regular rows
                    otherFeatures.forEach((feature, id) => {
                      rows.push({
                        id,
                        label: feature.name,
                        freeValue: '—',
                        plusValue: feature.inPlus ? '✓' : '—',
                        proValue: feature.inPro ? '✓' : '—',
                        isConsolidated: false,
                      });
                    });

                    return rows.map((row) => (
                      <tr key={row.id}>
                        <td className="feature-name">{row.label}</td>
                        <td className="feature-check">
                          <span className={`${row.isConsolidated ? 'feature-value' : 'check-icon'} ${row.freeValue === '—' ? 'no' : ''}`}>
                            {row.freeValue}
                          </span>
                        </td>
                        <td className="feature-check featured-column">
                          <span className={`${row.isConsolidated ? 'feature-value' : 'check-icon'} ${row.plusValue === '—' ? 'no' : 'yes'}`}>
                            {row.plusValue}
                          </span>
                        </td>
                        <td className="feature-check">
                          <span className={`${row.isConsolidated ? 'feature-value' : 'check-icon'} ${row.proValue === '—' ? 'no' : 'yes'}`}>
                            {row.proValue}
                          </span>
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
                <tfoot>
                  <tr className="table-actions-row">
                    <td></td>
                    <td className="table-action-cell">
                      {isOnFreePlan ? (
                        <button className="btn btn-secondary table-btn" disabled>Current Plan</button>
                      ) : freePlan?.id ? (
                        <CheckoutButton planId={freePlan.id} planPeriod="month">
                          <button className="btn btn-secondary table-btn">Downgrade</button>
                        </CheckoutButton>
                      ) : (
                        <button className="btn btn-secondary table-btn" onClick={() => window.location.href = '/subscription'}>Downgrade</button>
                      )}
                    </td>
                    <td className="table-action-cell featured-column">
                      {renderPlanButton(
                        plusPlan?.id || PLUS_PLAN_ID,
                        isOnPlusPlan,
                        true,
                        isOnFreePlan ? `Start ${plusFreeTrialDays} Day Trial` : isOnProPlan ? 'Downgrade' : 'Switch',
                        true
                      )}
                    </td>
                    <td className="table-action-cell">
                      {renderPlanButton(
                        proPlan?.id || PRO_PLAN_ID,
                        isOnProPlan,
                        false,
                        isOnPlusPlan ? 'Upgrade' : isOnFreePlan ? `Start ${proFreeTrialDays} Day Trial` : 'Switch',
                        true
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
