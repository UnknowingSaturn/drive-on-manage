import { supabase } from "@/integrations/supabase/client";

export const resendDriverCredentials = async (email: string) => {
  try {
    const { data, error } = await supabase.functions.invoke('resend-driver-credentials', {
      body: { email }
    });

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error resending driver credentials:', error);
    throw error;
  }
};