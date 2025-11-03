-- Add proposal_id to appointments table to link appointments created from proposals
ALTER TABLE public.appointments ADD COLUMN proposal_id UUID REFERENCES public.proposals(id);

-- Add index for better query performance
CREATE INDEX idx_appointments_proposal_id ON public.appointments(proposal_id);

-- Add comment for documentation
COMMENT ON COLUMN public.appointments.proposal_id IS 'Links appointment to the proposal it was created from';