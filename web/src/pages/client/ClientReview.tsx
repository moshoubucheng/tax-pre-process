import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClientContext } from '../../hooks/useClientContext';

export default function ClientReview() {
  const navigate = useNavigate();
  const { selectedClient } = useClientContext();

  useEffect(() => {
    if (!selectedClient) {
      navigate('/clients');
    }
  }, [selectedClient, navigate]);

  if (!selectedClient) {
    return null;
  }

  // Override the companyId param with selectedClient.id
  // We'll modify ReviewStation to accept an optional companyId prop
  return <ReviewStationWrapper companyId={selectedClient.id} />;
}

// Wrapper that provides companyId directly instead of from URL params
function ReviewStationWrapper({ companyId }: { companyId: string }) {
  // We need to create an inline version of ReviewStation that uses the prop
  // For now, redirect to the existing route
  const navigate = useNavigate();

  useEffect(() => {
    navigate(`/review/${companyId}`, { replace: true });
  }, [companyId, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
    </div>
  );
}
