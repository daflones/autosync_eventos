-- =====================================================
-- CONFIGURAÇÃO DO CRON JOB PARA PROCESSAMENTO DE CAMPANHAS
-- =====================================================

-- Habilitar a extensão pg_cron se não estiver habilitada
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- =====================================================
-- 1. FUNÇÃO PARA CHAMAR A EDGE FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION process_campaign_sends_cron()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    response_status integer;
    response_body text;
    function_url text;
BEGIN
    -- URL da edge function (ajustar conforme seu projeto)
    function_url := current_setting('app.supabase_url') || '/functions/v1/process-campaign-sends';
    
    -- Log do início do processamento
    RAISE LOG 'Iniciando processamento de campanhas via cron job';
    
    -- Chamar a edge function usando http extension
    SELECT status, content INTO response_status, response_body
    FROM http((
        'POST',
        function_url,
        ARRAY[
            http_header('Authorization', 'Bearer ' || current_setting('app.supabase_anon_key')),
            http_header('Content-Type', 'application/json')
        ],
        'application/json',
        '{}'
    )::http_request);
    
    -- Log do resultado
    IF response_status = 200 THEN
        RAISE LOG 'Processamento de campanhas concluído com sucesso: %', response_body;
    ELSE
        RAISE WARNING 'Erro no processamento de campanhas. Status: %, Body: %', response_status, response_body;
    END IF;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Erro ao executar processamento de campanhas: %', SQLERRM;
END;
$$;

-- =====================================================
-- 2. CONFIGURAR CRON JOB PARA EXECUTAR A CADA 10 MINUTOS
-- =====================================================

-- Remover job existente se houver
SELECT cron.unschedule('process-campaign-sends') WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'process-campaign-sends'
);

-- Criar novo job para executar a cada 10 minutos
SELECT cron.schedule(
    'process-campaign-sends',           -- Nome do job
    '*/10 * * * *',                   -- A cada 10 minutos
    'SELECT process_campaign_sends_cron();'  -- Comando a executar
);

-- =====================================================
-- 3. FUNÇÃO ALTERNATIVA USANDO HTTP DIRETO (BACKUP)
-- =====================================================

-- Habilitar extensão http se não estiver habilitada
CREATE EXTENSION IF NOT EXISTS http;

-- Função alternativa que faz chamada HTTP direta
CREATE OR REPLACE FUNCTION call_campaign_processor()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result json;
    function_url text;
    response http_response;
BEGIN
    -- URL da edge function
    function_url := current_setting('app.supabase_url', true) || '/functions/v1/process-campaign-sends';
    
    -- Se não conseguir pegar da configuração, usar URL padrão
    IF function_url IS NULL OR function_url = '/functions/v1/process-campaign-sends' THEN
        function_url := 'https://your-project.supabase.co/functions/v1/process-campaign-sends';
    END IF;
    
    -- Fazer chamada HTTP
    SELECT * INTO response FROM http((
        'POST',
        function_url,
        ARRAY[
            http_header('Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key', true)),
            http_header('Content-Type', 'application/json'),
            http_header('apikey', current_setting('app.supabase_anon_key', true))
        ],
        'application/json',
        '{}'
    )::http_request);
    
    -- Retornar resultado
    result := json_build_object(
        'status', response.status,
        'content', response.content::json
    );
    
    RETURN result;
END;
$$;

-- =====================================================
-- 4. CONFIGURAÇÕES DE SEGURANÇA E PERMISSÕES
-- =====================================================

-- Dar permissões para executar as funções
GRANT EXECUTE ON FUNCTION process_campaign_sends_cron() TO postgres;
GRANT EXECUTE ON FUNCTION call_campaign_processor() TO postgres;

-- =====================================================
-- 5. CONFIGURAÇÕES DO PROJETO (AJUSTAR CONFORME NECESSÁRIO)
-- =====================================================

-- Configurar variáveis do projeto (executar no dashboard do Supabase)
-- ALTER DATABASE postgres SET app.supabase_url = 'https://your-project.supabase.co';
-- ALTER DATABASE postgres SET app.supabase_anon_key = 'your-anon-key';
-- ALTER DATABASE postgres SET app.supabase_service_role_key = 'your-service-role-key';

-- =====================================================
-- 6. MONITORAMENTO E LOGS
-- =====================================================

-- Função para verificar status dos jobs
CREATE OR REPLACE FUNCTION get_cron_job_status()
RETURNS TABLE (
    jobid bigint,
    jobname text,
    schedule text,
    active boolean
)
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT 
        j.jobid,
        j.jobname,
        j.schedule,
        j.active
    FROM cron.job j
    WHERE j.jobname = 'process-campaign-sends';
$$;

-- Função para ver informações de execução (última execução)
CREATE OR REPLACE FUNCTION get_cron_job_execution_info()
RETURNS TABLE (
    jobid bigint,
    jobname text,
    schedule text,
    active boolean,
    last_execution timestamp with time zone,
    last_status text
)
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT 
        j.jobid,
        j.jobname,
        j.schedule,
        j.active,
        l.start_time as last_execution,
        l.status as last_status
    FROM cron.job j
    LEFT JOIN LATERAL (
        SELECT start_time, status
        FROM cron.job_run_details 
        WHERE jobid = j.jobid 
        ORDER BY start_time DESC 
        LIMIT 1
    ) l ON true
    WHERE j.jobname = 'process-campaign-sends';
$$;

-- Função para ver logs do cron
CREATE OR REPLACE FUNCTION get_cron_job_logs(limit_count integer DEFAULT 10)
RETURNS TABLE (
    jobid bigint,
    runid bigint,
    job_name text,
    status text,
    return_message text,
    start_time timestamp with time zone,
    end_time timestamp with time zone
)
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT 
        l.jobid,
        l.runid,
        j.jobname,
        l.status,
        l.return_message,
        l.start_time,
        l.end_time
    FROM cron.job_run_details l
    JOIN cron.job j ON j.jobid = l.jobid
    WHERE j.jobname = 'process-campaign-sends'
    ORDER BY l.start_time DESC
    LIMIT limit_count;
$$;

-- =====================================================
-- 7. COMANDOS ÚTEIS PARA GERENCIAMENTO
-- =====================================================

-- Para pausar o job:
-- SELECT cron.alter_job('process-campaign-sends', job_type := 'inactive');

-- Para reativar o job:
-- SELECT cron.alter_job('process-campaign-sends', job_type := 'active');

-- Para alterar o schedule (exemplo: a cada 5 minutos):
-- SELECT cron.alter_job('process-campaign-sends', schedule := '*/5 * * * *');

-- Para executar manualmente:
-- SELECT process_campaign_sends_cron();

-- Para ver status básico:
-- SELECT * FROM get_cron_job_status();

-- Para ver status com última execução:
-- SELECT * FROM get_cron_job_execution_info();

-- Para ver logs detalhados:
-- SELECT * FROM get_cron_job_logs(20);

-- =====================================================
-- COMENTÁRIOS E INSTRUÇÕES
-- =====================================================

/*
INSTRUÇÕES PARA CONFIGURAÇÃO:

1. Execute este SQL no seu banco Supabase
2. Ajuste as configurações do projeto no dashboard:
   - Vá em Settings > Database
   - Execute os comandos ALTER DATABASE para configurar as URLs e chaves
3. Deploy da edge function:
   - Coloque o arquivo index.ts em supabase/functions/process-campaign-sends/
   - Execute: supabase functions deploy process-campaign-sends
4. Configure as variáveis de ambiente na edge function:
   - SUPABASE_URL
   - SUPABASE_SERVICE_ROLE_KEY  
   - WEBHOOK_URL (URL do seu N8N)

MONITORAMENTO:
- Use get_cron_job_status() para ver se o job está ativo
- Use get_cron_job_execution_info() para ver última execução e status
- Use get_cron_job_logs() para ver histórico detalhado de execuções
- Logs da edge function aparecem no dashboard do Supabase

TROUBLESHOOTING:
- Se o job não executar, verifique se pg_cron está habilitado
- Se a edge function falhar, verifique as variáveis de ambiente
- Se não conseguir chamar a function, verifique as permissões e URLs
*/
