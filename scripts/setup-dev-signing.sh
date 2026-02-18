#!/bin/bash
set -e

CERT_NAME="Snipp Dev"

if security find-identity -v -p codesigning 2>/dev/null | grep -q "$CERT_NAME"; then
    echo "Certificate '$CERT_NAME' already exists. Skipping."
    exit 0
fi

echo "Creating self-signed code signing certificate: '$CERT_NAME'"

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

cat > "$TMPDIR/cert.conf" << EOF
[req]
distinguished_name = req_dn
prompt = no

[req_dn]
CN = $CERT_NAME

[v3_codesign]
keyUsage = digitalSignature
extendedKeyUsage = codeSigning
EOF

openssl req -x509 -newkey rsa:2048 \
    -keyout "$TMPDIR/key.pem" -out "$TMPDIR/cert.pem" \
    -days 3650 -nodes \
    -config "$TMPDIR/cert.conf" -extensions v3_codesign 2>/dev/null

openssl pkcs12 -export -legacy \
    -out "$TMPDIR/cert.p12" \
    -inkey "$TMPDIR/key.pem" -in "$TMPDIR/cert.pem" \
    -passout pass:snipp 2>/dev/null

security import "$TMPDIR/cert.p12" \
    -k ~/Library/Keychains/login.keychain-db \
    -T /usr/bin/codesign -P "snipp"

security add-trusted-cert -d -r trustRoot -p codeSign \
    -k ~/Library/Keychains/login.keychain-db "$TMPDIR/cert.pem"

echo ""
echo "Done. Certificate '$CERT_NAME' is ready for code signing."
echo "Verify with: security find-identity -v -p codesigning"
