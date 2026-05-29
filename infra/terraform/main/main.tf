terraform {
  required_version = ">= 1.3.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 4.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
  zone    = var.zone
}

provider "random" {}

locals {
  prefix                     = lower(replace(var.name_prefix, "/[^a-z0-9-]/", "-"))
  artifact_repo              = "${var.region}-docker.pkg.dev/${var.project_id}/${local.prefix}-repo"
  public_origin              = var.domain_name != "" ? "https://${var.domain_name}" : "http://${google_compute_global_address.lb.address}"
  cloudflare_ip_range_chunks = chunklist(var.cloudflare_ip_ranges, 10)
}

resource "google_project_service" "enabled_apis" {
  for_each = toset([
    "run.googleapis.com",
    "artifactregistry.googleapis.com",
    "sqladmin.googleapis.com",
    "secretmanager.googleapis.com",
    "cloudbuild.googleapis.com",
    "iam.googleapis.com",
    "compute.googleapis.com",
  ])

  project = var.project_id
  service = each.key

  disable_on_destroy = false
}

resource "google_artifact_registry_repository" "images" {
  project       = var.project_id
  location      = var.region
  repository_id = "${local.prefix}-repo"
  format        = "DOCKER"
  description   = "Repositorio de contenedores para main"

  depends_on = [google_project_service.enabled_apis]
}

resource "google_service_account" "cloud_run" {
  account_id   = "${local.prefix}-run-sa"
  display_name = "Cloud Run service account"

  depends_on = [google_project_service.enabled_apis]
}

resource "google_project_iam_member" "cloudsql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.cloud_run.email}"
}

resource "google_project_iam_member" "secret_accessor" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.cloud_run.email}"
}

resource "random_password" "db_user_password" {
  length           = var.db_password_length
  special          = true
  override_special = "_%@"
}

resource "random_password" "jwt_secret_key" {
  length  = var.secret_key_length
  special = false
}

resource "google_secret_manager_secret" "db_password" {
  secret_id = "${local.prefix}-db-password"

  replication {
    auto {}
  }

  depends_on = [google_project_service.enabled_apis]
}

resource "google_secret_manager_secret_version" "db_password_version" {
  secret      = google_secret_manager_secret.db_password.id
  secret_data = random_password.db_user_password.result
}

resource "google_secret_manager_secret" "jwt_secret_key" {
  secret_id = "${local.prefix}-jwt-secret-key"

  replication {
    auto {}
  }

  depends_on = [google_project_service.enabled_apis]
}

resource "google_secret_manager_secret_version" "jwt_secret_key_version" {
  secret      = google_secret_manager_secret.jwt_secret_key.id
  secret_data = random_password.jwt_secret_key.result
}

resource "google_sql_database_instance" "db" {
  name             = "${local.prefix}-db"
  project          = var.project_id
  region           = var.region
  database_version = "POSTGRES_15"

  settings {
    tier              = var.sql_tier
    disk_size         = var.sql_disk_size
    disk_type         = var.sql_disk_type
    edition           = "ENTERPRISE"
    activation_policy = "ALWAYS"
    availability_type = "ZONAL"

    ip_configuration {
      ipv4_enabled = true
      require_ssl  = false
    }

    backup_configuration {
      enabled = false
    }
  }

  depends_on = [google_project_service.enabled_apis]
}

resource "google_sql_database" "app_db" {
  name     = var.db_name
  project  = var.project_id
  instance = google_sql_database_instance.db.name
}

resource "google_sql_user" "app_user" {
  name     = var.db_user
  project  = var.project_id
  instance = google_sql_database_instance.db.name
  password = random_password.db_user_password.result
}

resource "google_compute_global_address" "lb" {
  name = "${local.prefix}-lb-ip"

  depends_on = [google_project_service.enabled_apis]
}

resource "google_compute_region_network_endpoint_group" "frontend" {
  name                  = "${local.prefix}-frontend-neg"
  network_endpoint_type = "SERVERLESS"
  region                = var.region

  cloud_run {
    service = "${local.prefix}-frontend"
  }
}

resource "google_compute_region_network_endpoint_group" "backend" {
  name                  = "${local.prefix}-backend-neg"
  network_endpoint_type = "SERVERLESS"
  region                = var.region

  cloud_run {
    service = "${local.prefix}-backend"
  }
}

resource "google_compute_backend_service" "frontend" {
  name                  = "${local.prefix}-frontend-backend"
  protocol              = "HTTP"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  security_policy       = google_compute_security_policy.cloudflare_only.id

  backend {
    group = google_compute_region_network_endpoint_group.frontend.id
  }
}

resource "google_compute_backend_service" "backend" {
  name                  = "${local.prefix}-backend-backend"
  protocol              = "HTTP"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  security_policy       = google_compute_security_policy.cloudflare_only.id

  backend {
    group = google_compute_region_network_endpoint_group.backend.id
  }
}

resource "google_compute_security_policy" "cloudflare_only" {
  name        = "${local.prefix}-cloudflare-only"
  description = "Permite acceso al Load Balancer solo desde Cloudflare"

  dynamic "rule" {
    for_each = local.cloudflare_ip_range_chunks

    content {
      action   = "allow"
      priority = 1000 + rule.key

      match {
        versioned_expr = "SRC_IPS_V1"
        config {
          src_ip_ranges = rule.value
        }
      }
    }
  }

  rule {
    action   = "deny(403)"
    priority = 2147483647

    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = ["*"]
      }
    }
  }
}

resource "google_compute_url_map" "app" {
  name            = "${local.prefix}-url-map"
  default_service = google_compute_backend_service.frontend.id

  host_rule {
    hosts        = ["*"]
    path_matcher = "app"
  }

  path_matcher {
    name            = "app"
    default_service = google_compute_backend_service.frontend.id

    path_rule {
      paths = [
        "/auth",
        "/auth/*",
        "/health",
        "/me",
        "/users",
        "/transactions",
        "/dashboard",
        "/audit",
        "/ws",
        "/ws/*",
      ]
      service = google_compute_backend_service.backend.id
    }
  }
}

resource "google_compute_target_http_proxy" "app" {
  name    = "${local.prefix}-http-proxy"
  url_map = var.enable_https ? google_compute_url_map.https_redirect[0].id : google_compute_url_map.app.id
}

resource "google_compute_global_forwarding_rule" "http" {
  name                  = "${local.prefix}-http-forwarding-rule"
  ip_address            = google_compute_global_address.lb.address
  port_range            = "80"
  target                = google_compute_target_http_proxy.app.id
  load_balancing_scheme = "EXTERNAL_MANAGED"
}

resource "google_compute_ssl_certificate" "cloudflare_origin" {
  count       = var.enable_https ? 1 : 0
  name_prefix = "${local.prefix}-cf-origin-"
  certificate = file(var.cloudflare_origin_certificate_path)
  private_key = file(var.cloudflare_origin_private_key_path)

  lifecycle {
    create_before_destroy = true
  }
}

resource "google_compute_target_https_proxy" "app" {
  count            = var.enable_https ? 1 : 0
  name             = "${local.prefix}-https-proxy"
  url_map          = google_compute_url_map.app.id
  ssl_certificates = [google_compute_ssl_certificate.cloudflare_origin[0].id]
}

resource "google_compute_global_forwarding_rule" "https" {
  count                 = var.enable_https ? 1 : 0
  name                  = "${local.prefix}-https-forwarding-rule"
  ip_address            = google_compute_global_address.lb.address
  port_range            = "443"
  target                = google_compute_target_https_proxy.app[0].id
  load_balancing_scheme = "EXTERNAL_MANAGED"
}

resource "google_compute_url_map" "https_redirect" {
  count = var.enable_https ? 1 : 0
  name  = "${local.prefix}-https-redirect"

  default_url_redirect {
    https_redirect         = true
    redirect_response_code = "MOVED_PERMANENTLY_DEFAULT"
    strip_query            = false
  }
}

