import { CP4_BACKEND_SERVICE, CP4_BACKEND_PROTOCOL } from '../../src/services/cpAnalysisBackend';

// Existing AI/parser fixtures exercise POST responses. Connection failures have their own HTTP suite.
export function withCP4Health(post:typeof fetch):typeof fetch {
  return async(input,options)=>String(input)==='/api/health'
    ? new Response(JSON.stringify({status:'ok',service:CP4_BACKEND_SERVICE,cpAnalysisProtocol:CP4_BACKEND_PROTOCOL,
      requestId:new Headers(options?.headers).get('X-CP4-Request-ID')}),{headers:{'Content-Type':'application/json'}})
    : post(input,options);
}
