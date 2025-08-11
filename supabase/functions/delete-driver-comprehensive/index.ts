import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DeleteDriverRequest {
  driverId: string;
  companyId?: string; // For additional security check
}

interface DeletionResult {
  success: boolean;
  message: string;
  deletedRecords: {
    [tableName: string]: number;
  };
  authUserDeleted: boolean;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({
      error: 'Method not allowed'
    }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const { driverId, companyId }: DeleteDriverRequest = await req.json();

    console.log('Starting comprehensive driver deletion:', { driverId, companyId });

    // First, get the driver profile to validate and get user_id
    const { data: driverProfile, error: fetchError } = await supabaseAdmin
      .from('driver_profiles')
      .select('user_id, company_id, status')
      .eq('id', driverId)
      .single();

    if (fetchError) {
      throw new Error(`Driver not found: ${fetchError.message}`);
    }

    // Additional security check if companyId is provided
    if (companyId && driverProfile.company_id !== companyId) {
      throw new Error('Driver does not belong to the specified company');
    }

    const userId = driverProfile.user_id;
    const deletedRecords: { [tableName: string]: number } = {};

    console.log('Found driver profile for user:', userId);

    // Check for active daily logs - prevent deletion if driver has active shift
    const { data: activeLogs } = await supabaseAdmin
      .from('daily_logs')
      .select('id')
      .eq('driver_id', driverId)
      .eq('status', 'in_progress')
      .limit(1);

    if (activeLogs && activeLogs.length > 0) {
      throw new Error('Cannot delete driver with active daily logs. Please complete or cancel their current shift first.');
    }

    // Start transaction-like deletion process
    // Delete in reverse dependency order to avoid foreign key constraints

    // 1. Delete vehicle checks
    const { error: vehicleChecksError, count: vehicleChecksCount } = await supabaseAdmin
      .from('vehicle_checks')
      .delete({ count: 'exact' })
      .eq('driver_id', driverId);

    if (vehicleChecksError) {
      console.error('Error deleting vehicle checks:', vehicleChecksError);
    } else {
      deletedRecords.vehicle_checks = vehicleChecksCount || 0;
    }

    // 2. Delete route feedback
    const { error: routeFeedbackError, count: routeFeedbackCount } = await supabaseAdmin
      .from('route_feedback')
      .delete({ count: 'exact' })
      .eq('driver_id', driverId);

    if (routeFeedbackError) {
      console.error('Error deleting route feedback:', routeFeedbackError);
    } else {
      deletedRecords.route_feedback = routeFeedbackCount || 0;
    }

    // 3. Delete SOD logs
    const { error: sodLogsError, count: sodLogsCount } = await supabaseAdmin
      .from('sod_logs')
      .delete({ count: 'exact' })
      .eq('driver_id', driverId);

    if (sodLogsError) {
      console.error('Error deleting SOD logs:', sodLogsError);
    } else {
      deletedRecords.sod_logs = sodLogsCount || 0;
    }

    // 4. Delete incident reports
    const { error: incidentReportsError, count: incidentReportsCount } = await supabaseAdmin
      .from('incident_reports')
      .delete({ count: 'exact' })
      .eq('driver_id', driverId);

    if (incidentReportsError) {
      console.error('Error deleting incident reports:', incidentReportsError);
    } else {
      deletedRecords.incident_reports = incidentReportsCount || 0;
    }

    // 5. Delete driver expenses
    const { error: expensesError, count: expensesCount } = await supabaseAdmin
      .from('driver_expenses')
      .delete({ count: 'exact' })
      .eq('driver_id', driverId);

    if (expensesError) {
      console.error('Error deleting driver expenses:', expensesError);
    } else {
      deletedRecords.driver_expenses = expensesCount || 0;
    }

    // 6. Delete driver earnings
    const { error: earningsError, count: earningsCount } = await supabaseAdmin
      .from('driver_earnings')
      .delete({ count: 'exact' })
      .eq('driver_id', driverId);

    if (earningsError) {
      console.error('Error deleting driver earnings:', earningsError);
    } else {
      deletedRecords.driver_earnings = earningsCount || 0;
    }

    // 7. Delete driver achievements
    const { error: achievementsError, count: achievementsCount } = await supabaseAdmin
      .from('driver_achievements')
      .delete({ count: 'exact' })
      .eq('driver_id', driverId);

    if (achievementsError) {
      console.error('Error deleting driver achievements:', achievementsError);
    } else {
      deletedRecords.driver_achievements = achievementsCount || 0;
    }

    // 8. Delete driver ratings
    const { error: ratingsError, count: ratingsCount } = await supabaseAdmin
      .from('driver_ratings')
      .delete({ count: 'exact' })
      .eq('driver_id', driverId);

    if (ratingsError) {
      console.error('Error deleting driver ratings:', ratingsError);
    } else {
      deletedRecords.driver_ratings = ratingsCount || 0;
    }

    // 9. Delete driver invoices
    const { error: invoicesError, count: invoicesCount } = await supabaseAdmin
      .from('driver_invoices')
      .delete({ count: 'exact' })
      .eq('driver_id', driverId);

    if (invoicesError) {
      console.error('Error deleting driver invoices:', invoicesError);
    } else {
      deletedRecords.driver_invoices = invoicesCount || 0;
    }

    // 10. Delete payments
    const { error: paymentsError, count: paymentsCount } = await supabaseAdmin
      .from('payments')
      .delete({ count: 'exact' })
      .eq('driver_id', driverId);

    if (paymentsError) {
      console.error('Error deleting payments:', paymentsError);
    } else {
      deletedRecords.payments = paymentsCount || 0;
    }

    // 11. Delete schedules
    const { error: schedulesError, count: schedulesCount } = await supabaseAdmin
      .from('schedules')
      .delete({ count: 'exact' })
      .eq('driver_id', driverId);

    if (schedulesError) {
      console.error('Error deleting schedules:', schedulesError);
    } else {
      deletedRecords.schedules = schedulesCount || 0;
    }

    // 12. Delete EOD reports
    const { error: eodReportsError, count: eodReportsCount } = await supabaseAdmin
      .from('eod_reports')
      .delete({ count: 'exact' })
      .eq('driver_id', driverId);

    if (eodReportsError) {
      console.error('Error deleting EOD reports:', eodReportsError);
    } else {
      deletedRecords.eod_reports = eodReportsCount || 0;
    }

    // 13. Delete daily logs (non-active ones should be remaining)
    const { error: dailyLogsError, count: dailyLogsCount } = await supabaseAdmin
      .from('daily_logs')
      .delete({ count: 'exact' })
      .eq('driver_id', driverId);

    if (dailyLogsError) {
      console.error('Error deleting daily logs:', dailyLogsError);
    } else {
      deletedRecords.daily_logs = dailyLogsCount || 0;
    }

    console.log('Deleted driver-related records:', deletedRecords);

    // Check if user has other profiles/roles in the system BEFORE deleting anything user-related
    const { data: otherUserCompanies } = await supabaseAdmin
      .from('user_companies')
      .select('company_id, role')
      .eq('user_id', userId)
      .neq('company_id', driverProfile.company_id); // Exclude current company

    const { data: otherProfiles } = await supabaseAdmin
      .from('profiles')
      .select('user_type')
      .eq('user_id', userId);

    // Check if user is an admin or has roles in other companies
    const hasAdminRole = otherProfiles && otherProfiles.some(p => p.user_type === 'admin');
    const hasOtherCompanyRoles = otherUserCompanies && otherUserCompanies.length > 0;

    console.log('User has other roles:', { hasOtherCompanyRoles, hasAdminRole });

    // 14. Delete the driver profile itself
    const { error: driverProfileError } = await supabaseAdmin
      .from('driver_profiles')
      .delete()
      .eq('id', driverId);

    if (driverProfileError) {
      throw new Error(`Failed to delete driver profile: ${driverProfileError.message}`);
    }
    deletedRecords.driver_profiles = 1;

    let authUserDeleted = false;

    // Only delete user completely if they have no other roles
    if (!hasOtherCompanyRoles && !hasAdminRole) {
      // Delete user-company associations
      const { error: userCompaniesError, count: userCompaniesCount } = await supabaseAdmin
        .from('user_companies')
        .delete({ count: 'exact' })
        .eq('user_id', userId);

      if (userCompaniesError) {
        console.error('Error deleting user companies:', userCompaniesError);
      } else {
        deletedRecords.user_companies = userCompaniesCount || 0;
      }

      // Delete profile
      const { error: profileError, count: profileCount } = await supabaseAdmin
        .from('profiles')
        .delete({ count: 'exact' })
        .eq('user_id', userId);

      if (profileError) {
        console.error('Error deleting profile:', profileError);
      } else {
        deletedRecords.profiles = profileCount || 0;
      }

      // Delete from auth.users
      try {
        const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
        if (authDeleteError) {
          console.error('Error deleting auth user:', authDeleteError);
        } else {
          authUserDeleted = true;
          console.log('Successfully deleted auth user');
        }
      } catch (authError) {
        console.error('Auth deletion error:', authError);
      }
    } else {
      console.log('Preserving user account - has other roles in system');
    }

    const result: DeletionResult = {
      success: true,
      message: `Driver deleted successfully. ${authUserDeleted ? 'User account also removed.' : 'User account preserved due to other roles.'}`,
      deletedRecords,
      authUserDeleted
    };

    console.log('Deletion completed:', result);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in comprehensive driver deletion:', error);
    return new Response(JSON.stringify({
      error: error.message || 'Failed to delete driver',
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};

serve(handler);