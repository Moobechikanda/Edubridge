ALTER PUBLICATION supabase_realtime ADD TABLE public.meeting_rsvps;
ALTER TABLE public.meeting_rsvps REPLICA IDENTITY FULL;