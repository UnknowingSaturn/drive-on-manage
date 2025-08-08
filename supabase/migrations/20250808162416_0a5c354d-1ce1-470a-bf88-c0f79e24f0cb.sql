-- Add road_lists column to rounds table
ALTER TABLE public.rounds 
ADD COLUMN road_lists TEXT[];

-- Add index for better performance when searching road lists
CREATE INDEX idx_rounds_road_lists ON public.rounds USING GIN(road_lists);