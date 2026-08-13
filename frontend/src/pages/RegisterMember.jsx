// RegisterMember redirects to the unified RegisterLead page with role=member preset
import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

export default function RegisterMember() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const invite = searchParams.get('invite') || searchParams.get('code') || '';

  useEffect(() => {
    const params = new URLSearchParams({ role: 'member' });
    if (invite) params.set('invite', invite);
    navigate(`/register/lead?${params}`, { replace: true });
  }, [navigate, invite]);

  return null;
}
