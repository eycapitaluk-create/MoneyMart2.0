import { supabase } from '../lib/supabase'

export const saveSimulatorRun = async ({
  page,
  simulatorType,
  inputPayload,
  outputPayload,
  assumptionVersion = 'v1',
}) => {
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData?.user?.id || null
  if (!userId) return { saved: false, reason: 'no_session' }

  const { error } = await supabase.from('simulator_runs').insert({
    user_id: userId,
    page,
    simulator_type: simulatorType,
    input_payload: inputPayload,
    output_payload: outputPayload,
    assumption_version: assumptionVersion,
  })
  if (error) throw error
  return { saved: true }
}
