#!/usr/bin/env bash

# CLI Test script for local KMS and DynamoDB setup

echo "---"
echo "🚀 Testing credstasher CLI with local setup..."
echo "---"

# Source environment variables
if [ -f .env.local ]; then
    source .env.local
    echo "✅ Environment variables loaded"
else
    echo "❌ .env.local file not found"
    exit 1
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
GRAY='\033[0;37m'
NC='\033[0m' # No Color

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0
TEST_NUMBER=0

# Helper functions
log_test() {
    ((TEST_NUMBER++))
    echo -e "${YELLOW}🧪 Test $TEST_NUMBER: $1${NC}"
}

log_pass() {
    echo -e "\t${GREEN}[PASS] $1${NC}"
    ((TESTS_PASSED++))
}

log_fail() {
    echo -e "\t${RED}[FAIL] $1${NC}"
    ((TESTS_FAILED++))
}

# CLI command wrapper
run_cli() {
    bun run cli -- "$@"
}

# Test helper to check command output
test_command() {
    local description="$1"
    local expected_exit_code="${2:-0}"
    shift 2
    
    echo ""
    log_test "$description"
    
    # Run the command and capture output and exit code
    output=$(run_cli "$@" 2>&1)
    actual_exit_code=$?
    
    if [ "$actual_exit_code" -eq "$expected_exit_code" ]; then
        log_pass "$description"
        # echo "$output"
    else
        log_fail "$description (expected exit code $expected_exit_code, got $actual_exit_code)"
        echo "$output"
    fi
    
    # Always return 0 to prevent script exit
    return 0
}

# Test helper to check if output contains expected string
test_output_contains() {
    local description="$1"
    local expected_string="$2"
    shift 2
    
    log_test "$description"
    
    # Run the command and capture output and exit code
    output=$(run_cli "$@" 2>&1)
    command_exit_code=$?
    
    if [ "$command_exit_code" -eq 0 ] && echo "$output" | grep -q "$expected_string"; then
        log_pass "$description"
    else
        log_fail "$description - expected output to contain '$expected_string'"
        echo "Actual output: $output"
        echo "Command exit code: $command_exit_code"
    fi
    
    # Always return 0 to prevent script exit
    return 0
}

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
timeout 30 bash -c 'until curl -s http://localhost:4599/ > /dev/null 2>&1; do sleep 1; done' || {
    echo -e "\r❌ KMS service not ready"
    exit 1
}

timeout 30 bash -c 'until curl -s http://localhost:8000/ > /dev/null 2>&1; do sleep 1; done' || {
    echo -e "\r❌ DynamoDB service not ready"
    exit 1
}

echo -e "\r✅ Services are ready"

# Cleanup function
cleanup() {
    echo ""
    echo "🧹 Cleaning up test data..."
    echo ""

    # Use set +e to prevent cleanup failures from affecting the script
    set +e
    {
        run_cli delete test-secret-1 --all 2>/dev/null
        run_cli delete test-secret-2 --all 2>/dev/null
        run_cli delete test-secret-with-context --all 2>/dev/null
        run_cli delete versioned-secret --all 2>/dev/null
        run_cli delete delete-me --all 2>/dev/null
    } 2>&1 | {
        output=$(cat)
        if [ $? -ne 0 ] && [ -n "$output" ]; then
            echo "$output"
        fi
    }
}

# Set up cleanup trap
trap cleanup EXIT

# Clean up any existing test data before starting
cleanup

echo ""
echo "🔧 Starting CLI Tests..."
echo ""

# Test 1: Setup command
test_command "Setup DynamoDB table" 0 setup

# Test 2: List empty secrets
test_output_contains "List secrets when empty" "No secrets found" list

# Test 3: Put a secret
test_command "Put a simple secret" 0 put test-secret-1 "my-secret-value"

# Test 4: Get the secret
test_output_contains "Get the secret" "my-secret-value" get test-secret-1

# Test 5: Put another secret
test_command "Put another secret" 0 put test-secret-2 "another-secret-value"

# Test 6: List secrets (should show both)
test_output_contains "List secrets shows both" "test-secret-1" list
test_output_contains "List should show second secret" "test-secret-2" list

# Test 7: Put secret with context
test_command "Put secret with encryption context" 0 put test-secret-with-context "context-value" --context '{"env":"test","app":"credstash"}'

# Test 8: Get secret with context
test_output_contains "Get secret with matching context" "context-value" get test-secret-with-context --context '{"env":"test","app":"credstash"}'

# Test 9: Get secret with wrong context (should fail)
test_command "Get secret with wrong context should fail" 1 get test-secret-with-context --context '{"env":"prod","app":"credstash"}'

# Test 10: Put secret with version
test_command "Put secret with explicit version" 0 put versioned-secret "3" -v 3

# Test 11: Put secret with autoversion
test_command "Put secret with autoversion" 0 put versioned-secret "version-2" --autoversion

# Test 12: Get specific version
test_output_contains "Get specific version" "3" get versioned-secret -v 3

# Test 13: Get latest version (should be version 2)
test_output_contains "Get latest version" "version-2" get versioned-secret

# Test 14: Get with --noline flag
log_test "Get secret with --noline flag"

output=$(run_cli get test-secret-1 --noline 2>&1)
exit_code=$?

if [ "$exit_code" -eq 0 ] && [[ "$output" == *"my-secret-value" ]]; then
    log_pass "Get secret with --noline flag"
else
    log_fail "Get secret with --noline flag - unexpected output:"
    echo -e "\t'$output' (exit code: $exit_code)"
fi

# Test 15: Delete specific version
test_command "Delete specific version" 0 delete versioned-secret -v 1

# Test 16: Verify version 1 is deleted but version 2 exists
test_command "Get deleted version should fail" 1 get versioned-secret -v 1
test_output_contains "Get remaining version should work" "version-2" get versioned-secret

# Test 17: Put secret for full deletion test
test_command "Put secret for deletion test" 0 put delete-me "will-be-deleted"

# Test 18: Delete all versions
test_command "Delete all versions" 0 delete delete-me --all

# Test 19: Verify secret is completely deleted
test_command "Get deleted secret should fail" 1 get delete-me

# Test 20: Test invalid JSON context
test_command "Invalid JSON context should fail" 1 put bad-context "value" --context "invalid-json"

# Test 21: Test missing secret
test_command "Get non-existent secret should fail" 1 get non-existent-secret

# Test 22: Test CLI help
test_output_contains "CLI help works" "credstasher" --help

# Test 23: Test list command shows current secrets
log_test "Final list command shows remaining secrets"
output=$(run_cli list 2>&1)
exit_code=$?

if [ "$exit_code" -eq 0 ]; then
    if echo "$output" | grep -q "test-secret-1" && echo "$output" | grep -q "test-secret-2"; then
        log_pass "Final list command shows remaining secrets"
    else
        log_fail "Final list command doesn't show expected secrets"
        echo "$output"
    fi
else
    log_fail "Final list command failed (exit code: $exit_code)"
    echo "$output"
fi

# Test 24: Test different table name
test_command "Test custom table name" 0 --table test-table setup

# Test 25: Test different region
test_command "Test custom region" 0 --region us-west-2 setup

if [ $TESTS_FAILED -gt 0 ]; then
    fail_color=$RED
    fail_icon="❌"
else
    fail_color=$GRAY
    fail_icon="😁"
fi

# Summary
echo ""
echo "📊 Test Results:"
echo "------------------"
echo -e "${GREEN}✅ Passed: $TESTS_PASSED${NC}"
echo -e "${fail_color}${fail_icon} Failed: $TESTS_FAILED${NC}"
echo "------------------"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}💥 Some tests failed!${NC}"
    exit 1
fi
