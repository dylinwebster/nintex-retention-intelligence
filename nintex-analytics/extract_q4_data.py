"""
Nintex Q4 FY26 Data Extraction Script
Runs all validated Databricks queries and writes a single q4_data.json file.
The JSON file is the data source for the Q4 retention dashboard.

Requirements (nintex-analytics venv):
    databricks-sql-connector
    azure-identity
    pandas

Usage:
    python3 extract_q4_data.py

Output:
    q4_data.json in the same directory as this script.
    File is only written if ALL queries succeed.
"""

import json
import sys
import traceback
import urllib.request
import urllib.error
from datetime import datetime, date

from azure.identity import AzureCliCredential
from databricks import sql as databricks_sql


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

DATABRICKS_HOST      = "adb-5305510795015065.5.azuredatabricks.net"
DATABRICKS_WAREHOUSE = "0fb3531f5fec7272"
DATABRICKS_RESOURCE  = "2ff814a6-3304-4ab8-85cb-cd0e6f879c1d"
OUTPUT_FILE          = "q4_data.json"

Q4_START = "2026-04-01"
Q4_END   = "2026-07-01"


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

def get_access_token():
    """Get Azure AD token for Databricks via az login credentials."""
    credential = AzureCliCredential()
    token = credential.get_token(f"{DATABRICKS_RESOURCE}/.default")
    return token.token


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def rows_to_dicts(cursor):
    """Convert cursor results to a list of dicts, JSON-serializable."""
    columns = [desc[0] for desc in cursor.description]
    results = []
    for row in cursor.fetchall():
        record = {}
        for col, val in zip(columns, row):
            if isinstance(val, (date, datetime)):
                record[col] = val.isoformat()
            elif hasattr(val, '__float__'):
                record[col] = float(val)
            else:
                record[col] = val
        results.append(record)
    return results


def run_query(cursor, name, sql):
    """Run a single query and return results as list of dicts. Raises on failure."""
    print(f"  Running: {name}...")
    cursor.execute(sql)
    results = rows_to_dicts(cursor)
    print(f"  Done: {len(results)} rows")
    return results


# ---------------------------------------------------------------------------
# Blob Upload
# ---------------------------------------------------------------------------

def upload_to_blob(local_path: str) -> str:
    """
    Upload a local file to the Vercel Blob store, overwriting the fixed key
    q4_data.json (x-add-random-suffix: 0).
    """
    import os
    token = os.environ.get("BLOB_READ_WRITE_TOKEN")
    if not token:
        raise EnvironmentError(
            "BLOB_READ_WRITE_TOKEN is not set. "
            "Export it before running this script."
        )

    with open(local_path, "rb") as f:
        payload = f.read()

    req = urllib.request.Request(
        "https://blob.vercel-storage.com/q4_data.json",
        data=payload,
        headers={
            "Authorization":        f"Bearer {token}",
            "Content-Type":         "application/octet-stream",
            "x-add-random-suffix":  "0",
            "x-vercel-blob-access": "private",
        },
        method="PUT",
    )

    try:
        with urllib.request.urlopen(req) as resp:
            result = json.loads(resp.read())
            return result.get("url") or result.get("downloadUrl", "unknown")
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")
        raise RuntimeError(f"Blob upload failed: HTTP {e.code} — {body}") from e


# ---------------------------------------------------------------------------
# Queries
# ---------------------------------------------------------------------------

Q_ACCOUNT_DIMENSIONS = """
WITH

q4_accounts AS (
    SELECT DISTINCT accountid
    FROM finance.salesforce_data
    WHERE snapshot_date = (SELECT MAX(snapshot_date) FROM finance.salesforce_data)
      AND close_date BETWEEN '2026-04-01' AND '2026-06-30'
      AND revenue_type = 'Renewal'
      AND stage NOT IN ('Closed Won', 'Closed Lost')
),

account_profile AS (
    SELECT
        a.Id                                                AS accountid,
        a.Name                                              AS account_name,
        COALESCE(a.Industry__c, a.Industry)                 AS industry,
        a.Account_Region__c                                 AS region,
        a.BillingCountry                                    AS billing_country,
        a.Customer_Segment_New__c                           AS customer_segment,
        a.SBI_Segment__c                                    AS sbi_segment,
        a.NumberOfEmployees                                 AS employee_count,
        a.Customer_Success_Manager_Email__c                 AS csm_email,
        INITCAP(REPLACE(
            SPLIT_PART(a.Customer_Success_Manager_Email__c, '@', 1),
        '.', ' '))                                          AS csm_name,
        a.Renewal_Specialist_Email__c                       AS renewal_specialist_email,
        COALESCE(
            a.Customer_Since_Date__c,
            a.EN_Customer_Since__c,
            a.Earliest_Closed_Won_date__c
        )                                                   AS customer_since_date,
        a.EN_Saas_Customer_Since__c                         AS saas_customer_since_date,
        a.Next_Renewal_Date__c                              AS next_renewal_date,
        a.Max_Active_Contract_End_Date__c                   AS max_contract_end_date,
        a.Churn_Risk__c                                     AS sfdc_churn_risk,
        a.Churn_Risk_Renewal__c                             AS sfdc_churn_risk_renewal,
        a.Churn_Risk_Trend__c                               AS sfdc_churn_risk_trend,
        a.Success_Churn_Risk__c                             AS cs_churn_risk,
        a.Success_Churn_Risk_Trend__c                       AS cs_churn_risk_trend,
        a.Red_Zone__c                                       AS red_zone_flag,
        a.Red_Zone_Reason__c                                AS red_zone_reason,
        a.Red_Zone_Category__c                              AS red_zone_category,
        a.Success_CSM_Acct_Health_Sentiment_Score__c        AS csm_health_score,
        a.Success_CSM_Acct_Health_Sentiment_Trend__c        AS csm_health_trend,
        a.Account_Health_Detail__c                          AS health_detail_notes,
        a.Nintex_Executive_Sponsor__c                       AS exec_sponsor,
        a.CS_Coverage_Model__c                              AS cs_coverage_model,
        a.CS_Engagement_Level__c                            AS cs_engagement_level,
        a.Hi_Po__c                                          AS high_potential_flag,
        a.Tingono_Link__c                                   AS tingono_url
    FROM salesforce.account a
    WHERE a.IsDeleted = false
),

tenure AS (
    SELECT
        accountid,
        customer_since_date,
        ROUND(DATEDIFF(CURRENT_DATE, customer_since_date) / 365.25, 1) AS tenure_years
    FROM account_profile
    WHERE customer_since_date IS NOT NULL
),

arr_current AS (
    SELECT accountid, SUM(lclacv_total) AS arr_now
    FROM finance.retention_arr_fact
    WHERE DATE_TRUNC('month', arr_month) = DATE_TRUNC('month', ADD_MONTHS(CURRENT_DATE, -1))
      AND lclacv_total > 0
    GROUP BY accountid
),

arr_3q_ago AS (
    SELECT accountid, SUM(lclacv_total) AS arr_prior
    FROM finance.retention_arr_fact
    WHERE DATE_TRUNC('month', arr_month) = DATE_TRUNC('month', ADD_MONTHS(CURRENT_DATE, -10))
      AND lclacv_total > 0
    GROUP BY accountid
),

arr_trend AS (
    SELECT
        c.accountid,
        ROUND(c.arr_now, 0)                                 AS current_arr,
        ROUND(p.arr_prior, 0)                               AS arr_3q_ago,
        CASE
            WHEN p.arr_prior IS NULL            THEN 'new'
            WHEN c.arr_now > p.arr_prior * 1.05 THEN 'growing'
            WHEN c.arr_now < p.arr_prior * 0.95 THEN 'shrinking'
            ELSE 'flat'
        END                                                 AS arr_trend_direction,
        ROUND(
            (c.arr_now - COALESCE(p.arr_prior, c.arr_now))
            / NULLIF(p.arr_prior, 0) * 100, 1
        )                                                   AS arr_trend_pct
    FROM arr_current c
    LEFT JOIN arr_3q_ago p ON c.accountid = p.accountid
),

product_mix AS (
    SELECT
        accountid,
        CONCAT_WS(', ', COLLECT_SET(Product_Hierarchy_L2)) AS active_products,
        COUNT(DISTINCT Product_Hierarchy_L2)                AS product_count
    FROM finance.arr_monthly
    WHERE Month_Start_Date = DATE_TRUNC('month', ADD_MONTHS(CURRENT_DATE, -1))
      AND ARR > 0
    GROUP BY accountid
),

gong_account_calls AS (
    SELECT
        cci.object_id   AS accountid,
        c.id            AS call_id,
        c.started       AS call_date,
        c.duration,
        c.call_outcome_name
    FROM gong.call_context_integration cci
    JOIN gong.call c ON cci.call_id = c.id
    WHERE cci.object_type       = 'Account'
      AND cci._fivetran_deleted = false
      AND c._fivetran_deleted   = false
      AND c.started IS NOT NULL
),

gong_summary AS (
    SELECT
        accountid,
        MAX(call_date)                                      AS last_gong_call_date,
        COUNT(CASE WHEN call_date >= ADD_MONTHS(CURRENT_DATE, -3)  THEN 1 END) AS gong_calls_last_90d,
        COUNT(CASE WHEN call_date >= ADD_MONTHS(CURRENT_DATE, -12) THEN 1 END) AS gong_calls_last_12m
    FROM gong_account_calls
    GROUP BY accountid
),

last_gong_rep AS (
    SELECT DISTINCT
        gac.accountid,
        FIRST_VALUE(cp.name) OVER (
            PARTITION BY gac.accountid ORDER BY gac.call_date DESC
        ) AS last_gong_rep
    FROM gong_account_calls gac
    JOIN gong.call_participant cp ON gac.call_id = cp.call_id
    WHERE cp.affiliation        = 'Internal'
      AND cp._fivetran_deleted  = false
    QUALIFY ROW_NUMBER() OVER (PARTITION BY gac.accountid ORDER BY gac.call_date DESC) = 1
),

cs_tasks AS (
    SELECT
        t.AccountId                             AS accountid,
        t.ActivityDate                          AS task_date,
        COALESCE(t.Activity_Type__c, 'Unknown') AS activity_type,
        t.Subject                               AS task_subject,
        t.OwnerId                               AS task_owner_id
    FROM salesforce.task t
    WHERE t.IsDeleted    = false
      AND t.AccountId IS NOT NULL
      AND t.ActivityDate <= CURRENT_DATE
      AND t.ActivityDate >= '2020-01-01'
      AND COALESCE(t.Activity_Type__c, 'null_included')
          IN ('Email', 'email', 'Call', 'call', 'Meeting', 'null_included')
),

task_agg AS (
    SELECT
        accountid,
        MAX(task_date)                                                              AS last_task_date,
        COUNT(CASE WHEN task_date >= ADD_MONTHS(CURRENT_DATE, -3)  THEN 1 END)     AS cs_touches_last_90d,
        COUNT(CASE WHEN task_date >= ADD_MONTHS(CURRENT_DATE, -12) THEN 1 END)     AS cs_touches_last_12m
    FROM cs_tasks
    GROUP BY accountid
),

task_last_type AS (
    SELECT DISTINCT
        accountid,
        FIRST_VALUE(activity_type) OVER (
            PARTITION BY accountid ORDER BY task_date DESC
        ) AS last_activity_type
    FROM cs_tasks
),

task_summary AS (
    SELECT
        ta.accountid,
        ta.last_task_date,
        ta.cs_touches_last_90d,
        ta.cs_touches_last_12m,
        tlt.last_activity_type
    FROM task_agg ta
    LEFT JOIN task_last_type tlt ON ta.accountid = tlt.accountid
),

last_contact AS (
    SELECT
        COALESCE(gs.accountid, ts.accountid)    AS accountid,
        GREATEST(
            gs.last_gong_call_date,
            CAST(ts.last_task_date AS TIMESTAMP)
        )                                       AS last_contact_date,
        DATEDIFF(CURRENT_DATE, GREATEST(
            gs.last_gong_call_date,
            CAST(ts.last_task_date AS TIMESTAMP)
        ))                                      AS days_since_last_contact,
        CASE
            WHEN GREATEST(gs.last_gong_call_date, CAST(ts.last_task_date AS TIMESTAMP))
                 IS NULL                        THEN 'no_record'
            WHEN DATEDIFF(CURRENT_DATE, GREATEST(
                gs.last_gong_call_date,
                CAST(ts.last_task_date AS TIMESTAMP)
            )) <= 30                            THEN 'active'
            WHEN DATEDIFF(CURRENT_DATE, GREATEST(
                gs.last_gong_call_date,
                CAST(ts.last_task_date AS TIMESTAMP)
            )) <= 90                            THEN 'cooling'
            WHEN DATEDIFF(CURRENT_DATE, GREATEST(
                gs.last_gong_call_date,
                CAST(ts.last_task_date AS TIMESTAMP)
            )) <= 180                           THEN 'at_risk_engagement'
            ELSE 'dark'
        END                                     AS engagement_status
    FROM gong_summary gs
    FULL OUTER JOIN task_summary ts ON gs.accountid = ts.accountid
),

final AS (
    SELECT
        qa.accountid,
        ap.account_name,
        ap.industry,
        ap.region,
        ap.billing_country,
        ap.customer_segment,
        ap.sbi_segment,
        ap.employee_count,
        ap.csm_email,
        ap.csm_name,
        ap.renewal_specialist_email,
        ap.customer_since_date,
        ap.saas_customer_since_date,
        t.tenure_years,
        ap.next_renewal_date,
        ap.max_contract_end_date,
        at.current_arr,
        at.arr_3q_ago,
        at.arr_trend_direction,
        at.arr_trend_pct,
        pm.active_products,
        pm.product_count,
        gs.last_gong_call_date,
        gs.gong_calls_last_90d,
        gs.gong_calls_last_12m,
        lgr.last_gong_rep,
        ts.last_task_date,
        ts.cs_touches_last_90d,
        ts.cs_touches_last_12m,
        ts.last_activity_type,
        lc.last_contact_date,
        lc.days_since_last_contact,
        lc.engagement_status,
        ap.sfdc_churn_risk,
        ap.sfdc_churn_risk_renewal,
        ap.sfdc_churn_risk_trend,
        ap.cs_churn_risk,
        ap.cs_churn_risk_trend,
        ap.red_zone_flag,
        ap.red_zone_reason,
        ap.red_zone_category,
        ap.csm_health_score,
        ap.csm_health_trend,
        ap.health_detail_notes,
        ap.exec_sponsor,
        ap.cs_coverage_model,
        ap.cs_engagement_level,
        ap.high_potential_flag,
        ap.tingono_url
    FROM q4_accounts qa
    LEFT JOIN account_profile ap ON qa.accountid = ap.accountid
    LEFT JOIN tenure t            ON qa.accountid = t.accountid
    LEFT JOIN arr_trend at        ON qa.accountid = at.accountid
    LEFT JOIN product_mix pm      ON qa.accountid = pm.accountid
    LEFT JOIN gong_summary gs     ON qa.accountid = gs.accountid
    LEFT JOIN last_gong_rep lgr   ON qa.accountid = lgr.accountid
    LEFT JOIN task_summary ts     ON qa.accountid = ts.accountid
    LEFT JOIN last_contact lc     ON qa.accountid = lc.accountid
)

SELECT * FROM final
ORDER BY current_arr DESC NULLS LAST
"""

Q_AT_RISK = f"""
WITH latest_snapshot AS (
    SELECT MAX(snapshot_date) AS max_date
    FROM finance.salesforce_data
),

sfdc_opps AS (
    SELECT
        s.accountid,
        s.opportunityid,
        s.stage,
        s.stage_group,
        s.forecast_category,
        s.product_hierarchy_l2,
        s.churn_risk_renewal,
        s.at_risk_type,
        s.close_date,
        s.supposed_to_renew_date,
        SUM(s.revenue_renewal_usd) AS atr_proxy_usd
    FROM finance.salesforce_data s
    CROSS JOIN latest_snapshot ls
    WHERE s.snapshot_date   = ls.max_date
      AND s.revenue_type    = 'Renewal'
      AND s.close_date     >= '{Q4_START}'
      AND s.close_date     <  '{Q4_END}'
    GROUP BY
        s.accountid, s.opportunityid, s.stage, s.stage_group,
        s.forecast_category, s.product_hierarchy_l2,
        s.churn_risk_renewal, s.at_risk_type,
        s.close_date, s.supposed_to_renew_date
),

current_arr AS (
    SELECT
        accountid,
        SUM(lclacv_total) AS current_arr_usd
    FROM finance.retention_arr_fact
    WHERE arr_month = (
        SELECT MAX(arr_month)
        FROM finance.retention_arr_fact
        WHERE arr_month <= DATE_TRUNC('month', CURRENT_DATE)
    )
      AND lclacv_total > 0
    GROUP BY accountid
),

account_names AS (
    SELECT accountid, MAX(account_name) AS account_name
    FROM finance.v_bookings_arr
    GROUP BY accountid
)

SELECT
    o.accountid,
    COALESCE(an.account_name, o.accountid) AS account_name,
    o.opportunityid,
    ca.current_arr_usd,
    o.atr_proxy_usd,
    ROUND(ABS(o.atr_proxy_usd - ca.current_arr_usd)
          / NULLIF(ca.current_arr_usd, 0) * 100, 1) AS arr_divergence_pct,
    o.close_date,
    o.supposed_to_renew_date,
    o.stage,
    o.stage_group,
    o.forecast_category,
    o.churn_risk_renewal,
    o.at_risk_type,
    o.product_hierarchy_l2 AS product_l2
FROM sfdc_opps o
LEFT JOIN current_arr ca ON o.accountid = ca.accountid
LEFT JOIN account_names an ON o.accountid = an.accountid
WHERE o.atr_proxy_usd > 0
  AND o.stage NOT IN ('Closed Lost', '6 - Closed Won')
ORDER BY o.atr_proxy_usd DESC
"""

Q_PIPELINE_SUMMARY = f"""
WITH latest_snapshot AS (
    SELECT MAX(snapshot_date) AS max_date
    FROM finance.salesforce_data
),

sfdc_opps AS (
    SELECT
        s.accountid,
        s.opportunityid,
        s.stage,
        s.stage_group,
        s.forecast_category,
        s.product_hierarchy_l2,
        SUM(s.revenue_renewal_usd) AS atr_proxy_usd
    FROM finance.salesforce_data s
    CROSS JOIN latest_snapshot ls
    WHERE s.snapshot_date   = ls.max_date
      AND s.revenue_type    = 'Renewal'
      AND s.close_date     >= '{Q4_START}'
      AND s.close_date     <  '{Q4_END}'
    GROUP BY
        s.accountid, s.opportunityid, s.stage,
        s.stage_group, s.forecast_category, s.product_hierarchy_l2
)

SELECT
    stage,
    stage_group,
    forecast_category,
    COUNT(DISTINCT opportunityid) AS opp_count,
    COUNT(DISTINCT accountid)     AS account_count,
    SUM(atr_proxy_usd)            AS total_atr
FROM sfdc_opps
GROUP BY stage, stage_group, forecast_category
ORDER BY total_atr DESC
"""

Q_WATERFALL = """
SELECT
    Quarter,
    FiscalYear,
    QuarterOfYear,
    SUM(ARR)        AS ending_arr,
    SUM(Churn)      AS churn,
    SUM(Downsell)   AS downsell,
    SUM(Expansion)  AS expansion,
    SUM(NewLogo)    AS new_logo
FROM finance.arr_quarterly
WHERE (FiscalYear = 2025 OR FiscalYear = 2026)
GROUP BY Quarter, FiscalYear, QuarterOfYear
ORDER BY Quarter
"""

Q_PRODUCT_ARR = """
SELECT
    Quarter_Start_Date,
    FiscalYear,
    QuarterOfYear,
    Product_Hierarchy_L2,
    COUNT(DISTINCT accountid) AS accounts,
    SUM(ARR)                  AS total_arr
FROM finance.arr_monthly
WHERE monthly_quarterly   = 'N'
  AND Month_Start_Date    = Quarter_End_Month
  AND (FiscalYear = 2025 OR FiscalYear = 2026)
  AND Quarter_Start_Date <= DATE_TRUNC('month', CURRENT_DATE)
GROUP BY Quarter_Start_Date, FiscalYear, QuarterOfYear, Product_Hierarchy_L2
ORDER BY Quarter_Start_Date, total_arr DESC
"""

Q_TOP_ACCOUNTS = f"""
WITH current_arr AS (
    SELECT
        accountid,
        SUM(lclacv_total) AS current_arr_usd
    FROM finance.retention_arr_fact
    WHERE arr_month = (
        SELECT MAX(arr_month)
        FROM finance.retention_arr_fact
        WHERE arr_month <= DATE_TRUNC('month', CURRENT_DATE)
    )
      AND lclacv_total > 0
    GROUP BY accountid
),

q4_opps AS (
    SELECT
        s.accountid,
        MAX(s.stage)                AS stage,
        MAX(s.stage_group)          AS stage_group,
        MAX(s.forecast_category)    AS forecast_category,
        MAX(s.churn_risk_renewal)   AS churn_risk_renewal,
        MAX(s.at_risk_type)         AS at_risk_type,
        MAX(s.close_date)           AS close_date,
        MAX(s.product_hierarchy_l2) AS product_l2,
        SUM(s.revenue_renewal_usd)  AS atr_proxy_usd
    FROM finance.salesforce_data s
    WHERE s.snapshot_date = (SELECT MAX(snapshot_date) FROM finance.salesforce_data)
      AND s.revenue_type  = 'Renewal'
      AND s.close_date   >= '{Q4_START}'
      AND s.close_date   <  '{Q4_END}'
    GROUP BY s.accountid
)

SELECT
    ca.accountid,
    COALESCE(an.account_name, ca.accountid) AS account_name,
    ca.current_arr_usd,
    o.atr_proxy_usd,
    o.stage,
    o.stage_group,
    o.forecast_category,
    o.churn_risk_renewal,
    o.at_risk_type,
    o.close_date,
    o.product_l2
FROM current_arr ca
LEFT JOIN q4_opps o ON ca.accountid = o.accountid
LEFT JOIN (
    SELECT accountid, MAX(account_name) AS account_name
    FROM finance.v_bookings_arr
    GROUP BY accountid
) an ON ca.accountid = an.accountid
WHERE o.accountid IS NOT NULL
ORDER BY ca.current_arr_usd DESC
LIMIT 50
"""

Q_WOW_MOVEMENT = f"""
WITH snapshot_dates AS (
    SELECT DISTINCT snapshot_date
    FROM finance.pipeline_create_close_history
    ORDER BY snapshot_date DESC
    LIMIT 2
),

current_snap AS (
    SELECT
        s.accountid,
        s.opportunityid,
        s.stage,
        s.forecast_category,
        s.at_risk_type,
        s.churn_risk_renewal,
        SUM(s.revenue_renewal_usd) AS atr_proxy_usd,
        s.snapshot_date
    FROM finance.pipeline_create_close_history s
    WHERE s.snapshot_date = (SELECT MAX(snapshot_date) FROM snapshot_dates)
      AND s.revenue_type  = 'Renewal'
      AND s.close_date   >= '{Q4_START}'
      AND s.close_date   <  '{Q4_END}'
    GROUP BY s.accountid, s.opportunityid, s.stage,
             s.forecast_category, s.at_risk_type,
             s.churn_risk_renewal, s.snapshot_date
),

prior_snap AS (
    SELECT
        s.accountid,
        s.opportunityid,
        s.stage,
        s.forecast_category,
        s.at_risk_type,
        s.churn_risk_renewal,
        SUM(s.revenue_renewal_usd) AS atr_proxy_usd,
        s.snapshot_date
    FROM finance.pipeline_create_close_history s
    WHERE s.snapshot_date = (SELECT MIN(snapshot_date) FROM snapshot_dates)
      AND s.revenue_type  = 'Renewal'
      AND s.close_date   >= '{Q4_START}'
      AND s.close_date   <  '{Q4_END}'
    GROUP BY s.accountid, s.opportunityid, s.stage,
             s.forecast_category, s.at_risk_type,
             s.churn_risk_renewal, s.snapshot_date
)

SELECT
    c.accountid,
    COALESCE(an.account_name, c.accountid) AS account_name,
    c.opportunityid,
    p.snapshot_date         AS prior_snapshot,
    c.snapshot_date         AS current_snapshot,
    p.stage                 AS stage_prior,
    c.stage                 AS stage_current,
    p.forecast_category     AS forecast_prior,
    c.forecast_category     AS forecast_current,
    p.at_risk_type          AS risk_type_prior,
    c.at_risk_type          AS risk_type_current,
    c.atr_proxy_usd
FROM current_snap c
JOIN prior_snap p ON c.opportunityid = p.opportunityid
LEFT JOIN (
    SELECT accountid, MAX(account_name) AS account_name
    FROM finance.v_bookings_arr
    GROUP BY accountid
) an ON c.accountid = an.accountid
WHERE c.stage             != p.stage
   OR c.forecast_category != p.forecast_category
   OR COALESCE(c.at_risk_type, '') != COALESCE(p.at_risk_type, '')
ORDER BY c.atr_proxy_usd DESC
"""

# ---------------------------------------------------------------------------
# New query: Pipeline Staleness
# ---------------------------------------------------------------------------
# For each open Q4 renewal opportunity, finds the most recent snapshot in
# pipeline_create_close_history where stage OR forecast_category changed
# vs the prior snapshot. This gives a true last_meaningful_change_date
# independent of the 1-week WoW window, enabling multi-week staleness signals
# in the Wednesday digest appendix slides.
#
# Output columns:
#   accountid, account_name, opportunityid,
#   current_stage, current_forecast_category,
#   last_change_date       -- most recent snapshot where something changed
#   days_since_change      -- integer days from last_change_date to today
#   prior_stage            -- stage before the most recent change
#   prior_forecast         -- forecast_category before the most recent change
#   atr_proxy_usd          -- from the most recent snapshot
#   close_date
#
# Staleness thresholds used in wednesday_digest.py:
#   0-7d:   fresh (changed this week)
#   8-14d:  recent
#   15-30d: stale
#   31+d:   critical staleness
# ---------------------------------------------------------------------------

Q_PIPELINE_STALENESS = f"""
WITH

-- All snapshots for open Q4 renewal opps, ordered chronologically
all_snaps AS (
    SELECT
        accountid,
        opportunityid,
        snapshot_date,
        stage,
        forecast_category,
        close_date,
        SUM(revenue_renewal_usd) AS atr_proxy_usd,
        LAG(stage)             OVER (
            PARTITION BY opportunityid ORDER BY snapshot_date
        ) AS prev_stage,
        LAG(forecast_category) OVER (
            PARTITION BY opportunityid ORDER BY snapshot_date
        ) AS prev_forecast
    FROM finance.pipeline_create_close_history
    WHERE revenue_type  = 'Renewal'
      AND close_date   >= '{Q4_START}'
      AND close_date   <  '{Q4_END}'
      AND stage NOT IN ('Closed Won', '6 - Closed Won', 'Closed Lost')
    GROUP BY
        accountid, opportunityid, snapshot_date,
        stage, forecast_category, close_date
),

-- Snapshots where something actually changed
change_snaps AS (
    SELECT *
    FROM all_snaps
    WHERE (stage != prev_stage AND prev_stage IS NOT NULL)
       OR (forecast_category != prev_forecast AND prev_forecast IS NOT NULL)
),

-- Most recent change per opportunity
last_change AS (
    SELECT
        opportunityid,
        MAX(snapshot_date)  AS last_change_date
    FROM change_snaps
    GROUP BY opportunityid
),

-- Current state (most recent snapshot)
current_state AS (
    SELECT
        accountid,
        opportunityid,
        stage               AS current_stage,
        forecast_category   AS current_forecast_category,
        close_date,
        atr_proxy_usd,
        snapshot_date       AS current_snapshot_date
    FROM all_snaps
    WHERE snapshot_date = (
        SELECT MAX(snapshot_date)
        FROM finance.pipeline_create_close_history
    )
),

-- Join current state with last change date
-- For opps that have never changed, last_change_date will be NULL;
-- treat that as stale from the beginning of the quarter.
combined AS (
    SELECT
        cs.accountid,
        cs.opportunityid,
        cs.current_stage,
        cs.current_forecast_category,
        cs.close_date,
        cs.atr_proxy_usd,
        COALESCE(lc.last_change_date, '{Q4_START}') AS last_change_date,
        DATEDIFF(
            CURRENT_DATE,
            COALESCE(lc.last_change_date, '{Q4_START}')
        )                                           AS days_since_change
    FROM current_state cs
    LEFT JOIN last_change lc ON cs.opportunityid = lc.opportunityid
),

-- Pull the stage/forecast values just before the last change
-- (for context: "moved FROM X to Y N days ago")
pre_change AS (
    SELECT
        cs2.opportunityid,
        cs2.prev_stage      AS prior_stage,
        cs2.prev_forecast   AS prior_forecast
    FROM change_snaps cs2
    JOIN last_change lc ON cs2.opportunityid = lc.opportunityid
                       AND cs2.snapshot_date  = lc.last_change_date
),

account_names AS (
    SELECT accountid, MAX(account_name) AS account_name
    FROM finance.v_bookings_arr
    GROUP BY accountid
)

SELECT
    c.accountid,
    COALESCE(an.account_name, c.accountid) AS account_name,
    c.opportunityid,
    c.current_stage,
    c.current_forecast_category,
    c.close_date,
    c.atr_proxy_usd,
    c.last_change_date,
    c.days_since_change,
    pc.prior_stage,
    pc.prior_forecast
FROM combined c
LEFT JOIN pre_change pc  ON c.opportunityid = pc.opportunityid
LEFT JOIN account_names an ON c.accountid   = an.accountid
WHERE c.atr_proxy_usd > 0
ORDER BY c.days_since_change DESC, c.atr_proxy_usd DESC
"""


# ---------------------------------------------------------------------------
# Forecast Summary (dual ATR — RevOps execution basis + Scheduled GRR basis)
# ---------------------------------------------------------------------------
#
# Produces a SINGLE ROW (not a list) containing all scalar values needed
# by ForecastCallScorecard.jsx. Stored in the blob payload under the key
# "forecast_summary" as a dict, not a list of dicts.
#
# RevOps ATR  = close_date in Q4. Includes pull-forwards. Quota denominator.
# Scheduled ATR = supposed_to_renew_date in Q4. Excludes pull-forwards. GRR denominator.
# The gap between them is decomposed into pull-forwards, push-outs, and
# missing-date opps so the UI can explain the discrepancy to any audience.
# ---------------------------------------------------------------------------

Q_FORECAST_SUMMARY = f"""
WITH

latest_snapshot AS (
    SELECT MAX(snapshot_date) AS snap_date
    FROM finance.salesforce_data
),

finance_arr_current AS (
    SELECT
        accountid,
        SUM(ARR) AS finance_arr
    FROM finance.arr_monthly
    WHERE Month_Start_Date = DATE_TRUNC('month', CURRENT_DATE)
    GROUP BY accountid
),

-- Esign monthly accounts to exclude from Scheduled ATR.
-- These accounts are on monthly/quarterly billing and should not count
-- toward the annual renewal denominator. This list is maintained manually.
esign_monthly_accounts AS (
    SELECT accountid FROM (VALUES
        ('0012v00003Ia34aAAB'), ('0012v00003Ia359AAB'), ('0012v00003Ia35RAAR'),
        ('0012v00003Ia35dAAB'), ('0012v00003Ia35rAAB'), ('0012v00003Ia36kAAB'),
        ('0012v00003Ia36nAAB'), ('0012v00003Ia37AAAR'), ('0012v00003Ia37aAAB'),
        ('0012v00003Ia37gAAB'), ('0012v00003Ia37oAAB'), ('0012v00003Ia38tAAB'),
        ('0012v00003Ia39HAAR'), ('0012v00003Ia3AkAAJ'), ('0012v00003Ia3AqAAJ'),
        ('0012v00003Ia3BzAAJ'), ('0012v00003Ia3C0AAJ'), ('0012v00003Ia3C8AAJ'),
        ('0012v00003Ia3CBAAZ'), ('0012v00003Ia3CiAAJ'), ('0012v00003Ia3ClAAJ')
    ) AS t(accountid)
),

-- Join to salesforce.opportunity to get Contract_Length_months__c.
-- This field is not in finance.salesforce_data but is required to identify
-- annual renewals (12 months) vs multi-year later years (24, 36 months).
-- Validated: Contract_Length_months__c = 12 matches BI "Annual Renewal" filter.
opp_contract_length AS (
    SELECT
        o.Id             AS opportunityid,
        o.Contract_Length_months__c
    FROM salesforce.opportunity o
    WHERE o.IsDeleted = false
),

all_q4_opps AS (
    SELECT
        s.opportunityid,
        s.accountid,
        s.stage,
        s.close_date,
        s.supposed_to_renew_date,
        s.churn_risk_renewal,
        s.at_risk_type,
        s.product_hierarchy_l2,
        ocl.Contract_Length_months__c,
        SUM(s.revenue_renewal_usd)   AS opp_atr_usd,
        MAX(f.finance_arr)           AS finance_arr_usd,

        -- RevOps ATR: close_date in Q4. Includes pull-forwards. Quota denominator.
        MAX(CASE
            WHEN s.close_date >= '{Q4_START}'
             AND s.close_date <  '{Q4_END}'
            THEN 1 ELSE 0
        END) AS in_revops_q4,

        -- Scheduled ATR: BI-matched definition.
        --   supposed_to_renew_date in Q4
        --   AND Contract_Length_months__c = 12 (annual only, excludes multi-year later years)
        --   AND product_hierarchy_l2 != CE Esign
        --   AND accountid NOT IN esign monthly list
        -- Validated against BI $64.8M — residual ~$600K is snapshot timing difference.
        MAX(CASE
            WHEN s.supposed_to_renew_date >= '{Q4_START}'
             AND s.supposed_to_renew_date <  '{Q4_END}'
             AND ocl.Contract_Length_months__c = 12
             AND s.product_hierarchy_l2 != 'CE Esign'
             AND s.accountid NOT IN (SELECT accountid FROM esign_monthly_accounts)
            THEN 1 ELSE 0
        END) AS in_sched_q4,

        -- Pull-forward: close_date in Q4 but not in scheduled ATR
        MAX(CASE
            WHEN s.close_date >= '{Q4_START}'
             AND s.close_date <  '{Q4_END}'
             AND (s.supposed_to_renew_date < '{Q4_START}'
                  OR s.supposed_to_renew_date IS NULL)
            THEN 1 ELSE 0
        END) AS is_pull_forward,

        -- Push-out: scheduled for Q4 but close_date pushed beyond Q4
        MAX(CASE
            WHEN s.supposed_to_renew_date >= '{Q4_START}'
             AND s.supposed_to_renew_date <  '{Q4_END}'
             AND s.close_date >= '{Q4_END}'
            THEN 1 ELSE 0
        END) AS is_pushed_out,

        MAX(CASE
            WHEN s.supposed_to_renew_date IS NULL THEN 1 ELSE 0
        END) AS missing_renew_date

    FROM finance.salesforce_data s
    CROSS JOIN latest_snapshot ls
    LEFT JOIN finance_arr_current f   ON f.accountid   = s.accountid
    LEFT JOIN opp_contract_length ocl ON ocl.opportunityid = s.opportunityid
    WHERE s.snapshot_date = ls.snap_date
      AND s.revenue_type  = 'Renewal'
      AND (
          (s.close_date >= '{Q4_START}' AND s.close_date < '{Q4_END}')
          OR
          (s.supposed_to_renew_date >= '{Q4_START}' AND s.supposed_to_renew_date < '{Q4_END}')
      )
    GROUP BY
        s.opportunityid, s.accountid, s.stage,
        s.close_date, s.supposed_to_renew_date,
        s.churn_risk_renewal, s.at_risk_type,
        s.product_hierarchy_l2,
        ocl.Contract_Length_months__c
),

bucketed AS (
    SELECT
        *,
        CASE
            WHEN stage IN ('6 - Closed Won', 'Closed Won')         THEN 'closed_won'
            WHEN stage IN ('Closed Lost', 'Closed Lost - Churned',
                           'Closed Lost - Downgraded')             THEN 'closed_lost'
            WHEN stage IN ('Submitted for Booking')                THEN 'submitted'
            ELSE 'open'
        END AS outcome,
        CASE
            WHEN stage IN ('6 - Closed Won', 'Closed Won',
                           'Closed Lost', 'Closed Lost - Churned',
                           'Closed Lost - Downgraded')             THEN NULL
            WHEN stage IN ('Submitted for Booking', '5 - Closing') THEN 'commit'
            WHEN stage IN ('4 - Negotiation')                      THEN 'most_likely'
            WHEN stage IN ('3 - Contact Initiated')                THEN 'best_case'
            ELSE                                                        'pipeline_only'
        END AS forecast_bucket,
        CASE
            WHEN finance_arr_usd IS NULL OR finance_arr_usd = 0    THEN 0
            WHEN ABS(opp_atr_usd - finance_arr_usd)
                 / finance_arr_usd > 0.10                          THEN 1
            ELSE 0
        END AS has_arr_divergence
    FROM all_q4_opps
),

summary AS (
    SELECT
        ROUND(SUM(CASE WHEN in_revops_q4=1 THEN opp_atr_usd ELSE 0 END),0)             AS revops_total_atr,
        ROUND(SUM(CASE WHEN in_revops_q4=1 AND outcome='closed_won' THEN opp_atr_usd ELSE 0 END),0)   AS revops_closed_won,
        ROUND(SUM(CASE WHEN in_revops_q4=1 AND outcome='closed_lost' THEN opp_atr_usd ELSE 0 END),0)  AS revops_closed_lost,
        ROUND(SUM(CASE WHEN in_revops_q4=1 AND outcome='submitted' THEN opp_atr_usd ELSE 0 END),0)    AS revops_submitted,
        ROUND(SUM(CASE WHEN in_revops_q4=1 AND outcome='open' THEN opp_atr_usd ELSE 0 END),0)         AS revops_open,
        ROUND(SUM(CASE WHEN in_revops_q4=1 AND forecast_bucket='commit' THEN opp_atr_usd ELSE 0 END),0)                                AS revops_commit_open,
        ROUND(SUM(CASE WHEN in_revops_q4=1 AND forecast_bucket IN ('commit','most_likely') THEN opp_atr_usd ELSE 0 END),0)             AS revops_most_likely_open,
        ROUND(SUM(CASE WHEN in_revops_q4=1 AND forecast_bucket IN ('commit','most_likely','best_case') THEN opp_atr_usd ELSE 0 END),0) AS revops_best_case_open,
        ROUND(SUM(CASE WHEN in_revops_q4=1 AND outcome='open' AND (churn_risk_renewal IS NOT NULL OR at_risk_type IS NOT NULL) THEN opp_atr_usd ELSE 0 END),0) AS revops_at_risk_open,

        ROUND(SUM(CASE WHEN in_sched_q4=1 THEN opp_atr_usd ELSE 0 END),0)              AS sched_total_atr,
        ROUND(SUM(CASE WHEN in_sched_q4=1 AND outcome='closed_won' THEN opp_atr_usd ELSE 0 END),0)    AS sched_closed_won,
        ROUND(SUM(CASE WHEN in_sched_q4=1 AND outcome='closed_lost' THEN opp_atr_usd ELSE 0 END),0)   AS sched_closed_lost,
        ROUND(SUM(CASE WHEN in_sched_q4=1 AND outcome='submitted' THEN opp_atr_usd ELSE 0 END),0)     AS sched_submitted,
        ROUND(SUM(CASE WHEN in_sched_q4=1 AND outcome='open' THEN opp_atr_usd ELSE 0 END),0)          AS sched_open,
        ROUND(SUM(CASE WHEN in_sched_q4=1 AND forecast_bucket='commit' THEN opp_atr_usd ELSE 0 END),0)                                AS sched_commit_open,
        ROUND(SUM(CASE WHEN in_sched_q4=1 AND forecast_bucket IN ('commit','most_likely') THEN opp_atr_usd ELSE 0 END),0)             AS sched_most_likely_open,
        ROUND(SUM(CASE WHEN in_sched_q4=1 AND forecast_bucket IN ('commit','most_likely','best_case') THEN opp_atr_usd ELSE 0 END),0) AS sched_best_case_open,

        ROUND(SUM(CASE WHEN is_pull_forward=1 THEN opp_atr_usd ELSE 0 END),0)          AS pull_forward_atr,
        COUNT(DISTINCT CASE WHEN is_pull_forward=1 THEN opportunityid END)              AS pull_forward_opp_count,
        ROUND(SUM(CASE WHEN is_pushed_out=1 THEN opp_atr_usd ELSE 0 END),0)            AS pushed_out_atr,
        COUNT(DISTINCT CASE WHEN is_pushed_out=1 THEN opportunityid END)               AS pushed_out_opp_count,
        ROUND(SUM(CASE WHEN missing_renew_date=1 AND in_revops_q4=1 THEN opp_atr_usd ELSE 0 END),0) AS missing_renew_date_atr,
        COUNT(DISTINCT CASE WHEN missing_renew_date=1 AND in_revops_q4=1 THEN opportunityid END)     AS missing_renew_date_count,

        COUNT(DISTINCT opportunityid)   AS total_opps,
        COUNT(DISTINCT accountid)       AS total_accounts,
        SUM(has_arr_divergence)         AS divergence_count,

        ROUND(DATEDIFF('2026-06-30', CURRENT_DATE) / 7.0, 1) AS weeks_remaining_in_q4,
        (SELECT snap_date FROM latest_snapshot)               AS pipeline_snapshot_date,
        86.0  AS grr_target_pct,
        82.5  AS grr_pure_target_pct
    FROM bucketed
)

SELECT
    revops_total_atr, revops_closed_won, revops_closed_lost,
    revops_submitted, revops_open, revops_commit_open,
    revops_most_likely_open, revops_best_case_open, revops_at_risk_open,

    ROUND(revops_closed_won + revops_submitted, 0)                  AS revops_booked_total,
    ROUND(revops_closed_won + revops_commit_open, 0)                AS revops_commit_total,
    ROUND(revops_closed_won + revops_most_likely_open, 0)           AS revops_most_likely_total,
    ROUND(revops_closed_won + revops_best_case_open, 0)             AS revops_best_case_total,

    ROUND(revops_closed_won / NULLIF(revops_total_atr,0) * 100, 1)                             AS revops_won_pct,
    ROUND((revops_closed_won + revops_submitted) / NULLIF(revops_total_atr,0) * 100, 1)        AS revops_booked_pct,
    ROUND((revops_closed_won + revops_commit_open) / NULLIF(revops_total_atr,0) * 100, 1)      AS revops_commit_pct,
    ROUND((revops_closed_won + revops_most_likely_open) / NULLIF(revops_total_atr,0) * 100, 1) AS revops_most_likely_pct,
    ROUND((revops_closed_won + revops_best_case_open) / NULLIF(revops_total_atr,0) * 100, 1)   AS revops_best_case_pct,

    ROUND(revops_total_atr * grr_target_pct / 100.0, 0)                                        AS revops_arr_needed,
    ROUND((revops_total_atr * grr_target_pct / 100.0) - revops_closed_won, 0)                  AS revops_gap_to_target,
    ROUND(((revops_total_atr * grr_target_pct / 100.0) - revops_closed_won) / NULLIF(weeks_remaining_in_q4,0), 0) AS revops_weekly_rate_needed,
    CASE
        WHEN (revops_closed_won + revops_best_case_open) >= (revops_total_atr * grr_target_pct / 100.0) THEN 'achievable'
        WHEN (revops_closed_won + revops_most_likely_open) >= (revops_total_atr * grr_target_pct / 100.0) THEN 'requires_most_likely'
        ELSE 'gap_exceeds_best_case'
    END AS revops_grr_achievability,

    sched_total_atr, sched_closed_won, sched_closed_lost,
    sched_submitted, sched_open, sched_commit_open,
    sched_most_likely_open, sched_best_case_open,

    ROUND(sched_closed_won + sched_submitted, 0)                    AS sched_booked_total,
    ROUND(sched_closed_won + sched_commit_open, 0)                  AS sched_commit_total,
    ROUND(sched_closed_won + sched_most_likely_open, 0)             AS sched_most_likely_total,
    ROUND(sched_closed_won + sched_best_case_open, 0)               AS sched_best_case_total,

    ROUND(sched_closed_won / NULLIF(sched_total_atr,0) * 100, 1)                               AS sched_won_pct,
    ROUND((sched_closed_won + sched_submitted) / NULLIF(sched_total_atr,0) * 100, 1)           AS sched_booked_pct,
    ROUND((sched_closed_won + sched_commit_open) / NULLIF(sched_total_atr,0) * 100, 1)         AS sched_commit_pct,
    ROUND((sched_closed_won + sched_most_likely_open) / NULLIF(sched_total_atr,0) * 100, 1)    AS sched_most_likely_pct,
    ROUND((sched_closed_won + sched_best_case_open) / NULLIF(sched_total_atr,0) * 100, 1)      AS sched_best_case_pct,

    ROUND(sched_total_atr * grr_target_pct / 100.0, 0)                                         AS sched_arr_needed,
    ROUND((sched_total_atr * grr_target_pct / 100.0) - sched_closed_won, 0)                    AS sched_gap_to_target,
    ROUND(((sched_total_atr * grr_target_pct / 100.0) - sched_closed_won) / NULLIF(weeks_remaining_in_q4,0), 0) AS sched_weekly_rate_needed,
    CASE
        WHEN (sched_closed_won + sched_best_case_open) >= (sched_total_atr * grr_target_pct / 100.0) THEN 'achievable'
        WHEN (sched_closed_won + sched_most_likely_open) >= (sched_total_atr * grr_target_pct / 100.0) THEN 'requires_most_likely'
        ELSE 'gap_exceeds_best_case'
    END AS sched_grr_achievability,

    ROUND((sched_closed_won + sched_commit_open) / NULLIF(sched_total_atr,0) * 100, 1)         AS sched_grr_at_commit,
    ROUND((sched_closed_won + sched_most_likely_open) / NULLIF(sched_total_atr,0) * 100, 1)    AS sched_grr_at_most_likely,
    ROUND((sched_closed_won + sched_best_case_open) / NULLIF(sched_total_atr,0) * 100, 1)      AS sched_grr_at_best_case,

    pull_forward_atr, pull_forward_opp_count,
    pushed_out_atr, pushed_out_opp_count,
    missing_renew_date_atr, missing_renew_date_count,
    ROUND(revops_total_atr - sched_total_atr, 0) AS atr_basis_gap,

    total_opps, total_accounts, divergence_count,
    weeks_remaining_in_q4, pipeline_snapshot_date,
    grr_target_pct, grr_pure_target_pct

FROM summary
"""


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    print("Nintex Q4 FY26 Data Extraction")
    print(f"Target: {OUTPUT_FILE}")
    print("-" * 40)

    print("Authenticating via Azure CLI...")
    try:
        token = get_access_token()
        print("  Token acquired.")
    except Exception as e:
        print(f"  AUTH FAILED: {e}")
        print("  Make sure you are logged in via 'az login' before running this script.")
        sys.exit(1)

    print("Connecting to Databricks...")
    try:
        connection = databricks_sql.connect(
            server_hostname = DATABRICKS_HOST,
            http_path       = f"/sql/1.0/warehouses/{DATABRICKS_WAREHOUSE}",
            access_token    = token,
        )
        cursor = connection.cursor()
        print("  Connected.")
    except Exception as e:
        print(f"  CONNECTION FAILED: {e}")
        sys.exit(1)

    # Standard queries — each returns a list of dicts stored as-is.
    queries = [
        ("at_risk",              Q_AT_RISK),
        ("pipeline_summary",     Q_PIPELINE_SUMMARY),
        ("waterfall",            Q_WATERFALL),
        ("product_arr",          Q_PRODUCT_ARR),
        ("top_accounts",         Q_TOP_ACCOUNTS),
        ("wow_movement",         Q_WOW_MOVEMENT),
        ("account_dimensions",   Q_ACCOUNT_DIMENSIONS),
        ("pipeline_staleness",   Q_PIPELINE_STALENESS),
    ]

    print("Running queries...")
    results = {}
    try:
        for name, sql in queries:
            results[name] = run_query(cursor, name, sql)

        # Forecast summary — single row stored as a dict, not a list.
        # ForecastCallScorecard.jsx expects data={forecastSummary} (object, not array).
        print("  Running: forecast_summary...")
        cursor.execute(Q_FORECAST_SUMMARY)
        rows = rows_to_dicts(cursor)
        if not rows:
            raise ValueError(
                "forecast_summary query returned 0 rows — "
                "check Q4 date range and revenue_type filter."
            )
        results["forecast_summary"] = rows[0]   # single dict, not a list
        print(f"  Done: 1 row ({len(rows[0])} columns)")

    except Exception as e:
        print(f"\n  QUERY FAILED: {e}")
        traceback.print_exc()
        cursor.close()
        connection.close()
        print("\nAborted: q4_data.json was NOT written.")
        sys.exit(1)
    finally:
        cursor.close()
        connection.close()

    print("Writing output...")
    payload = {
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "q4_start":     Q4_START,
        "q4_end":       Q4_END,
        **results
    }

    with open(OUTPUT_FILE, "w") as f:
        json.dump(payload, f, indent=2, default=str)

    print(f"  Written: {OUTPUT_FILE}")

    print("Uploading to Vercel Blob...")
    try:
        blob_url = upload_to_blob(OUTPUT_FILE)
        print(f"  Uploaded: {blob_url}")
    except (RuntimeError, EnvironmentError) as e:
        print(f"\n  UPLOAD FAILED: {e}")
        print("  JSON written locally but dashboard was NOT refreshed.")
        sys.exit(1)

    print("-" * 40)
    print("Done.")


if __name__ == "__main__":
    main()
