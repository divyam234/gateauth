# Caddy integration

The included `Caddyfile` demonstrates a protected host named `app.localhost`.

## Request flow

1. Gatehouse-owned routes such as `/login`, `/two-factor`, `/admin/*`, and `/api/auth/*` go directly to Gatehouse.
2. Caddy removes every incoming `X-Auth-*` identity header.
3. `forward_auth` calls Gatehouse at `/api/verify?application=default-app`.
4. Caddy copies only the authorization response headers.
5. On a 2xx decision, the original request is proxied to the upstream application.
6. Non-2xx decisions are returned without contacting the upstream.

## Protecting multiple hosts

Create one application in the Gatehouse console for each policy boundary, then map the Caddy site to the application slug:

```caddyfile
reports.example.com {
    request_header -X-Auth-User-Id
    request_header -X-Auth-User-Email
    request_header -X-Auth-User-Name
    request_header -X-Auth-User-Role
    request_header -X-Auth-MFA
    request_header -X-Auth-Method

    forward_auth gatehouse:3001 {
        uri /api/verify?application=reports
        copy_headers X-Auth-User-Id X-Auth-User-Email X-Auth-User-Name X-Auth-User-Role X-Auth-MFA X-Auth-Method X-Auth-Application-Id X-Auth-Application-Slug X-Auth-Public X-Auth-Reason
    }

    reverse_proxy reports:8080
}
```

A slug is stable and suitable for configuration. Application display names, domains, upstream health paths, and policy can change in the console.

Gatehouse can also resolve by forwarded host when `application` is omitted, but explicit slugs avoid ambiguity and make configuration review easier.

## Gatehouse routes on a protected host

The included configuration routes these paths to Gatehouse before forward-auth:

```text
/login
/verify-otp
/two-factor
/dashboard
/admin
/admin/*
/api/auth/*
/api/public/*
/api/admin/*
/api/health
/api/ready
/assets/*
```

Keep `/api/admin/*` behind Gatehouse's own administrator session checks. It must bypass the upstream application's forward-auth loop but is not publicly authorized.

## Identity headers

Upstreams may consume:

- `X-Auth-User-Id`
- `X-Auth-User-Email`
- `X-Auth-User-Name`
- `X-Auth-User-Role`
- `X-Auth-MFA`
- `X-Auth-Method`
- `X-Auth-Application-Id`
- `X-Auth-Application-Slug`
- `X-Auth-Public`

The upstream must accept these only from the trusted Caddy network. It should not be directly internet-accessible.

`X-Auth-MFA=true` means that the current session contains a server-recorded MFA verification time. It does not merely mean the user has configured 2FA.
