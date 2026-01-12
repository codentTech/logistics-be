#!/bin/bash

# OpsCore API Testing Script
# This script tests all major API endpoints

set -e

BASE_URL="http://localhost:3000"
TENANT_ID=""
TOKEN=""
SHIPMENT_ID=""
DRIVER_ID=""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🧪 OpsCore API Testing Script${NC}"
echo "================================"
echo ""

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo -e "${YELLOW}⚠️  jq is not installed. Installing...${NC}"
    echo "Please install jq: brew install jq (macOS) or apt-get install jq (Linux)"
    exit 1
fi

# Get tenant ID
if [ -z "$TENANT_ID" ]; then
    echo -e "${YELLOW}📝 Please enter your Tenant ID (from npm run seed output):${NC}"
    read -r TENANT_ID
fi

echo -e "${BLUE}🔐 Step 1: Login${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"admin@tenant1.com\",
    \"password\": \"password123\",
    \"tenantId\": \"$TENANT_ID\"
  }")

TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.token')

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
    echo -e "${RED}❌ Login failed!${NC}"
    echo "$LOGIN_RESPONSE" | jq
    exit 1
fi

echo -e "${GREEN}✅ Login successful!${NC}"
echo "Token: ${TOKEN:0:50}..."
echo ""

# Get driver ID from seed (you might need to adjust this)
echo -e "${BLUE}📝 Please enter your Driver ID (from npm run seed output):${NC}"
read -r DRIVER_ID

echo ""
echo -e "${BLUE}📦 Step 2: Create Shipment${NC}"
SHIPMENT_RESPONSE=$(curl -s -X POST "$BASE_URL/v1/shipments" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: test-$(date +%s)" \
  -d '{
    "pickupAddress": "123 Main St, New York, NY 10001",
    "deliveryAddress": "456 Oak Ave, Brooklyn, NY 11201",
    "customerName": "John Doe",
    "customerPhone": "+1234567890"
  }')

SHIPMENT_ID=$(echo "$SHIPMENT_RESPONSE" | jq -r '.data.id')

if [ "$SHIPMENT_ID" == "null" ] || [ -z "$SHIPMENT_ID" ]; then
    echo -e "${RED}❌ Failed to create shipment!${NC}"
    echo "$SHIPMENT_RESPONSE" | jq
    exit 1
fi

echo -e "${GREEN}✅ Shipment created!${NC}"
echo "Shipment ID: $SHIPMENT_ID"
echo "$SHIPMENT_RESPONSE" | jq '.data | {id, status, customerName}'
echo ""

echo -e "${BLUE}🚗 Step 3: Assign Driver${NC}"
ASSIGN_RESPONSE=$(curl -s -X POST "$BASE_URL/v1/shipments/$SHIPMENT_ID/assign-driver" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"driverId\": \"$DRIVER_ID\"
  }")

ASSIGN_STATUS=$(echo "$ASSIGN_RESPONSE" | jq -r '.data.status')

if [ "$ASSIGN_STATUS" == "ASSIGNED" ]; then
    echo -e "${GREEN}✅ Driver assigned!${NC}"
    echo "$ASSIGN_RESPONSE" | jq '.data | {id, status, driverId}'
else
    echo -e "${RED}❌ Failed to assign driver!${NC}"
    echo "$ASSIGN_RESPONSE" | jq
fi
echo ""

echo -e "${BLUE}📊 Step 4: Update Shipment Status${NC}"
STATUS_RESPONSE=$(curl -s -X POST "$BASE_URL/v1/shipments/$SHIPMENT_ID/status" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "PICKED_UP"
  }')

NEW_STATUS=$(echo "$STATUS_RESPONSE" | jq -r '.data.status')

if [ "$NEW_STATUS" == "PICKED_UP" ]; then
    echo -e "${GREEN}✅ Status updated!${NC}"
    echo "$STATUS_RESPONSE" | jq '.data | {id, status, pickedUpAt}'
else
    echo -e "${RED}❌ Failed to update status!${NC}"
    echo "$STATUS_RESPONSE" | jq
fi
echo ""

echo -e "${BLUE}📍 Step 5: Update Driver Location${NC}"
LOCATION_RESPONSE=$(curl -s -X POST "$BASE_URL/v1/drivers/$DRIVER_ID/location" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "latitude": 40.7128,
    "longitude": -74.0060,
    "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"
  }')

if echo "$LOCATION_RESPONSE" | jq -e '.success' > /dev/null; then
    echo -e "${GREEN}✅ Location updated!${NC}"
    echo "$LOCATION_RESPONSE" | jq
else
    echo -e "${RED}❌ Failed to update location!${NC}"
    echo "$LOCATION_RESPONSE" | jq
fi
echo ""

echo -e "${BLUE}📊 Step 6: Get Dashboard Summary${NC}"
DASHBOARD_RESPONSE=$(curl -s -X GET "$BASE_URL/v1/dashboard/summary" \
  -H "Authorization: Bearer $TOKEN")

if echo "$DASHBOARD_RESPONSE" | jq -e '.success' > /dev/null; then
    echo -e "${GREEN}✅ Dashboard summary retrieved!${NC}"
    echo "$DASHBOARD_RESPONSE" | jq '.data'
else
    echo -e "${RED}❌ Failed to get dashboard!${NC}"
    echo "$DASHBOARD_RESPONSE" | jq
fi
echo ""

echo -e "${BLUE}🔍 Step 7: GraphQL Query${NC}"
GRAPHQL_RESPONSE=$(curl -s -X POST "$BASE_URL/graphql" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query { opsSummary { totalShipments activeShipments deliveredToday driversOnline } }"
  }')

if echo "$GRAPHQL_RESPONSE" | jq -e '.data' > /dev/null; then
    echo -e "${GREEN}✅ GraphQL query successful!${NC}"
    echo "$GRAPHQL_RESPONSE" | jq '.data.opsSummary'
else
    echo -e "${RED}❌ GraphQL query failed!${NC}"
    echo "$GRAPHQL_RESPONSE" | jq
fi
echo ""

echo -e "${GREEN}✅ All API tests completed!${NC}"
echo ""
echo "📖 For detailed testing guide, see: API_TESTING_GUIDE.md"
echo "🌐 Swagger UI: http://localhost:3000/docs"
echo "🔍 GraphQL Playground: http://localhost:3000/graphql"

