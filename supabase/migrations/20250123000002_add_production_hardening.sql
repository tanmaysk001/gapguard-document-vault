-- Production hardening for process_document function
-- Phase 3D: Rate limiting and edge case handling

-- Rate limiting table to prevent abuse
CREATE TABLE IF NOT EXISTS public.rate_limit_usage (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    request_count INTEGER DEFAULT 1,
    last_request_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Enable RLS on rate_limit_usage
ALTER TABLE public.rate_limit_usage ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see their own rate limit data
CREATE POLICY "Users can manage own rate limits" ON public.rate_limit_usage
FOR ALL USING (auth.uid()::text = user_id);

-- Function to increment request count atomically
CREATE OR REPLACE FUNCTION public.increment_request_count(p_user_id TEXT)
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.rate_limit_usage (user_id, request_count, last_request_at, created_at)
    VALUES (p_user_id, 1, NOW(), NOW())
    ON CONFLICT (user_id) DO UPDATE
    SET request_count = public.rate_limit_usage.request_count + 1,
        last_request_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is within rate limits
CREATE OR REPLACE FUNCTION public.check_rate_limit(p_user_id TEXT, p_max_requests INTEGER DEFAULT 100, p_window_hours INTEGER DEFAULT 24)
RETURNS BOOLEAN AS $$
DECLARE
    current_count INTEGER;
    window_start TIMESTAMPTZ;
BEGIN
    window_start := NOW() - (p_window_hours || ' hours')::INTERVAL;
    
    SELECT request_count INTO current_count
    FROM public.rate_limit_usage
    WHERE user_id = p_user_id 
    AND last_request_at > window_start;
    
    -- If no record or outside window, they're within limits
    IF current_count IS NULL THEN
        RETURN TRUE;
    END IF;
    
    -- Check if they're within limits
    RETURN current_count < p_max_requests;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 