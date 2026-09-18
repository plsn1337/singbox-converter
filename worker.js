export default {
  async fetch(request, env, ctx) {
    const urlObj = new URL(request.url);
    
    // =========================================================================
    // Supports aggregating multiple subscription links using the '|' delimiter.
    // Links can be provided via the '?subs=' query parameter (Recommended) 
    // or directly appended to the URL pathname.
    //
    // Example 1: Query Parameter (Recommended)
    //   Prevents issues with URL-encoded characters (e.g., '|' becoming '%7C').
    //   URL: https://<worker>.workers.dev/?subs=https://sub1.com/abc|https://sub2.com/xyz
    //
    // Example 2: Path-based (Fallback)
    //   URL: https://<worker>.workers.dev/https://sub1.com/abc|https://sub2.com/xyz
    // =========================================================================
    
    const subsParam = urlObj.searchParams.get('subs');
    let rawTarget = subsParam ? subsParam : (urlObj.pathname.substring(1) + urlObj.search);

    if (!rawTarget) {
      return new Response(
        JSON.stringify({ error: "Usage: https://workers.dev/<url1>|<url2> or ?subs=<url1>|<url2>", hint: "Include http:// or https://" }), 
        { status: 400, headers: { "Content-Type": "application/json; charset=utf-8" } }
      );
    }

    const targetUrls = rawTarget.replace(/%7C/gi, '|').split('|').map(u => u.trim()).filter(u => u);

    for (const targetUrl of targetUrls) {
      if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        return new Response(
          JSON.stringify({ error: "Invalid URL detected", hint: "All URLs must start with http:// or https://", invalid_url: targetUrl }), 
          { status: 400, headers: { "Content-Type": "application/json; charset=utf-8" } }
        );
      }
    }

    try {
      const responses = await Promise.all(targetUrls.map(async (targetUrl) => {
        const response = await fetch(targetUrl, { headers: { 'User-Agent': 'v2rayN/sing-box-converter' } });
        if (!response.ok) throw new Error(`Failed to fetch ${targetUrl}. Status: ${response.status}`);
        
        let txt = (await response.text()).trim();
        if (txt && !txt.includes('://')) {
          try { txt = atob(txt.replace(/[\r\n\s]/g, '')); } catch (e) {}
        }
        return txt;
      }));

      let text = responses.join('\n').trim();
      const lines = text.split(/[\r\n]+/);
      
      const parsedOutbounds = [];
      const usedTags = new Set();

      for (let line of lines) {
        line = line.trim();
        if (!line) continue;
        try {
          let outbound = null;
          if (line.startsWith('vless://')) outbound = parseVless(line);
          else if (line.startsWith('trojan://')) outbound = parseTrojan(line);
          else if (line.startsWith('hysteria2://') || line.startsWith('hy2://')) outbound = parseHysteria2(line);
          
          if (outbound) {
            let tag = outbound.tag;
            let counter = 1;
            while (usedTags.has(tag)) {
              tag = `${outbound.tag}_${counter}`;
              counter++;
            }
            usedTags.add(tag);
            outbound.tag = tag;
            parsedOutbounds.push(outbound);
          }
        } catch (err) { 
        }
      }

      const uniqueTags = Array.from(usedTags);
      const config = generateExactConfig(parsedOutbounds, uniqueTags);

      return new Response(JSON.stringify(config, null, 2), {
        headers: { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*" }
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { "Content-Type": "application/json" }
      });
    }
  }
};

function parseVless(link) {
  const url = new URL(link);
  const params = url.searchParams;
  const name = decodeURIComponent(url.hash.substring(1)) || `${url.hostname}:${url.port}`;
  
  const outbound = {
    tag: name,
    type: "vless",
    server: url.hostname,
    server_port: parseInt(url.port) || 443,
    uuid: url.username
  };

  const flow = params.get('flow');
  if (flow) outbound.flow = flow;

  const security = params.get('security');
  if (security === 'tls' || security === 'reality') {
    outbound.tls = {
      enabled: true,
      server_name: params.get('sni') || url.hostname,
      utls: { enabled: true, fingerprint: params.get('fp') || "firefox" },
      insecure: true
    };
    
    const alpn = params.get('alpn');
    if (alpn) outbound.tls.alpn = alpn.split(',');

    if (security === 'reality') {
      outbound.tls.reality = {
        enabled: true,
        public_key: params.get('pbk') || "",
        short_id: params.get('sid') || ""
      };
    }
  }

  const netType = params.get('type') || 'tcp';
  if (netType !== 'tcp') {
    outbound.transport = { type: netType === 'xhttp' ? 'http' : netType };
    
    if (netType === 'ws' || netType === 'http' || netType === 'xhttp') {
      outbound.transport.path = params.get('path') || "/";
      const host = params.get('host');
      if (host) outbound.transport.headers = { "Host": host };
      
      if (netType === 'ws') {
        const ed = params.get('ed');
        const eh = params.get('eh');
        if (ed) outbound.transport.max_early_data = parseInt(ed);
        if (eh) outbound.transport.early_data_header_name = eh;
      }
    } else if (netType === 'grpc') {
      outbound.transport.service_name = params.get('serviceName') || "grpc";
    }
  }

  return outbound;
}

function parseTrojan(link) {
  const url = new URL(link);
  const params = url.searchParams;
  const name = decodeURIComponent(url.hash.substring(1)) || `${url.hostname}:${url.port}`;

  const outbound = {
    tag: name,
    type: "trojan",
    server: url.hostname,
    server_port: parseInt(url.port) || 443,
    password: url.username
  };

  const netType = params.get('type') || 'tcp';
  if (netType !== 'tcp') {
    outbound.network = "tcp";
    outbound.transport = { type: netType === 'xhttp' ? 'http' : netType };
    
    if (netType === 'ws' || netType === 'http' || netType === 'xhttp') {
      outbound.transport.path = params.get('path') || "/";
      const host = params.get('host');
      if (host) outbound.transport.headers = { "Host": host };
      
      if (netType === 'ws') {
        const ed = params.get('ed');
        const eh = params.get('eh');
        if (ed) outbound.transport.max_early_data = parseInt(ed);
        if (eh) outbound.transport.early_data_header_name = eh;
      }
    } else if (netType === 'grpc') {
      outbound.transport.service_name = params.get('serviceName') || "grpc";
    }
  }

  const security = params.get('security') || 'tls';
  if (security === 'tls') {
    outbound.tls = {
      enabled: true,
      server_name: params.get('sni') || url.hostname,
      utls: { enabled: true, fingerprint: params.get('fp') || "firefox" },
      insecure: true
    };
    const alpn = params.get('alpn');
    if (alpn) outbound.tls.alpn = alpn.split(',');
  }

  return outbound;
}

function parseHysteria2(link) {
  const url = new URL(link);
  const params = url.searchParams;
  const name = decodeURIComponent(url.hash.substring(1)) || `${url.hostname}:${url.port}`;

  const outbound = {
    type: "hysteria2",
    server: url.hostname,
    server_port: parseInt(url.port) || 443,
    password: url.username || params.get('password') || "",
    tls: {
      enabled: true,
      server_name: params.get('sni') || url.hostname,
      insecure: true
    },
    tag: name
  };

  const alpn = params.get('alpn');
  if (alpn) outbound.tls.alpn = alpn.split(',');

  const obfsType = params.get('obfs') || params.get('obfs-type');
  if (obfsType && obfsType !== 'none') {
    outbound.obfs = {
      type: obfsType,
      password: params.get('obfs-password') || params.get('obfsParam') || ""
    };
  }

  return outbound;
}

function generateExactConfig(uniqueParsedOutbounds, uniqueTags) {
  const outbounds = [
    {
      "tag": "Proxy",
      "type": "selector",
      "outbounds": ["auto", "direct", ...uniqueTags]
    },
    {
      "tag": "auto",
      "type": "urltest",
      "outbounds": uniqueTags,
      "url": "http://www.gstatic.com/generate_204",
      "interval": "10m",
      "tolerance": 50
    },
    {
      "type": "direct",
      "tag": "direct"
    },
    ...uniqueParsedOutbounds
  ];

  return {
    "log": { "level": "info", "timestamp": true },
    "experimental": {
      "clash_api": {
        "external_controller": "127.0.0.1:9090",
        "external_ui": "ui",
        "secret": "",
        "external_ui_download_url": "https://gh-proxy.com/https://github.com/MetaCubeX/metacubexd/archive/refs/heads/gh-pages.zip",
        "external_ui_download_detour": "direct",
        "default_mode": "rule"
      },
      "cache_file": { "enabled": true, "store_fakeip": true, "store_dns": true }
    },
    "dns": {
      "servers": [
        { "tag": "local", "type": "local" },
        {
          "tag": "hosts", "type": "hosts", "predefined": {
            "dns.alidns.com": ["223.5.5.5", "223.6.6.6"],
            "dns.google": ["8.8.8.8", "8.8.4.4"]
          }
        },
        { "tag": "alidns", "type": "https", "server": "dns.alidns.com", "domain_resolver": "hosts" },
        { "tag": "ggdns", "type": "https", "server": "dns.google", "domain_resolver": "hosts", "detour": "Proxy" },
        { "tag": "fakeip", "type": "fakeip", "inet4_range": "198.18.0.0/15", "inet6_range": "fc00::/18" }
      ],
      "rules": [
        { "clash_mode": "direct", "server": "local" },
        { "clash_mode": "global", "server": "ggdns" },
        { "query_type": ["A", "AAAA"], "server": "fakeip" },
        { "rule_set": "geosite-cn", "server": "local" },
        { "action": "evaluate", "server": "alidns" },
        { "match_response": true, "rule_set": "geoip-cn", "action": "respond" }
      ],
      "final": "ggdns",
      "strategy": "prefer_ipv4"
    },
    "inbounds": [
      {
        "tag": "tun-in", "type": "tun",
        "address": ["172.19.0.0/30", "fdfe:dcba:9876::0/126"],
        "stack": "system", "auto_route": true, "strict_route": true,
        "platform": { "http_proxy": { "enabled": true, "server": "127.0.0.1", "server_port": 7890 } }
      },
      { "tag": "mixed-in", "type": "mixed", "listen": "127.0.0.1", "listen_port": 7890 }
    ],
    "outbounds": outbounds,
    "http_clients": [
      { "tag": "default", "detour": "Proxy" },
      { "tag": "direct", "detour": "direct" }
    ],
    "route": {
      "default_domain_resolver": { "server": "local" },
      "auto_detect_interface": true,
      "final": "Proxy",
      "rules": [
        { "domain_suffix": ["nodebuf.com"], "outbound": "Proxy" },
        { "inbound": ["tun-in", "mixed-in"], "action": "sniff" },
        { "type": "logical", "mode": "or", "rules": [{ "port": 53 }, { "protocol": "dns" }], "action": "hijack-dns" },
        { "rule_set": "geosite-category-ads-all", "clash_mode": "rule", "action": "reject" },
        { "rule_set": "geosite-category-ads-all", "clash_mode": "global", "outbound": "Proxy" },
        { "clash_mode": "direct", "outbound": "direct" },
        { "clash_mode": "global", "outbound": "Proxy" },
        { "domain": ["clash.razord.top", "yacd.metacubex.one", "yacd.haishan.me", "d.metacubex.one"], "outbound": "direct" },
        { "ip_is_private": true, "outbound": "direct" },
        { "rule_set": ["geoip-cn", "geosite-cn"], "outbound": "direct" }
      ],
      "rule_set": [
        { "tag": "geosite-category-ads-all", "type": "remote", "format": "binary", "url": "https://gh-proxy.com/raw.githubusercontent.com/MetaCubeX/meta-rules-dat/sing/geo/geosite/category-ads-all.srs", "http_client": "default" },
        { "tag": "geoip-cn", "type": "remote", "format": "binary", "url": "https://gh-proxy.com/raw.githubusercontent.com/MetaCubeX/meta-rules-dat/sing/geo/geoip/cn.srs", "http_client": "default" },
        { "tag": "geosite-cn", "type": "remote", "format": "binary", "url": "https://gh-proxy.com/raw.githubusercontent.com/MetaCubeX/meta-rules-dat/sing/geo/geosite/cn.srs", "http_client": "default" }
      ]
    }
  };
}
