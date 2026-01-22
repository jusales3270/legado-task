import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { audioUrl, transcriptionType } = await req.json();

    if (!audioUrl || !transcriptionType) {
      return new Response(
        JSON.stringify({ error: 'audioUrl and transcriptionType are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY is not configured');
      return new Response(
        JSON.stringify({ error: 'API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fetching audio file from:', audioUrl);

    // Fetch the audio file
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      console.error('Failed to fetch audio:', audioResponse.status);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch audio file' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const audioBlob = await audioResponse.blob();
    const audioBytes = await audioBlob.arrayBuffer();
    const base64Audio = btoa(
      new Uint8Array(audioBytes).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );

    console.log('Audio file converted to base64, size:', base64Audio.length);

    // Determine prompt based on transcription type
    const systemPrompt = transcriptionType === 'summarize'
      ? 'Você é um assistente especializado em sumarização de áudio. Analise o áudio e forneça um resumo conciso e claro do conteúdo principal em Português do Brasil.'
      : 'Você é um assistente especializado em transcrição de áudio. Transcreva todo o conteúdo do áudio palavra por palavra em Português do Brasil, mantendo a ordem e contexto originais.';

    console.log('Sending request to Lovable AI with type:', transcriptionType);

    // Call Lovable AI Gateway
    const lovableResponse = await fetch(
      'https://ai.gateway.lovable.dev/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            {
              role: 'system',
              content: systemPrompt + ' Responda e transcreva exclusivamente em Português do Brasil.'
            },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: transcriptionType === 'summarize'
                    ? 'Resuma este áudio em Português do Brasil:'
                    : 'Transcreva este áudio em Português do Brasil:'
                },
                {
                  type: 'input_audio',
                  input_audio: {
                    data: base64Audio,
                    format: audioBlob.type?.includes('mp3') ? 'mp3' : 'wav'
                  }
                }
              ]
            }
          ]
        })
      }
    );

    if (!lovableResponse.ok) {
      const errorText = await lovableResponse.text();
      console.error('Lovable AI error:', lovableResponse.status, errorText);

      // Handle rate limits
      if (lovableResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de taxa excedido. Por favor, tente novamente em alguns instantes.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (lovableResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos insuficientes. Por favor, adicione créditos ao seu workspace.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ error: 'Failed to transcribe audio', details: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const lovableData = await lovableResponse.json();
    console.log('Received response from Lovable AI');

    const transcription = lovableData.choices?.[0]?.message?.content || '';

    if (!transcription) {
      console.error('No transcription in response:', lovableData);
      return new Response(
        JSON.stringify({ error: 'No transcription generated' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Transcription successful');

    return new Response(
      JSON.stringify({
        transcription,
        type: transcriptionType
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in transcribe-audio function:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
