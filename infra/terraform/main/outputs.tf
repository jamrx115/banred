output "frontend_url" {
  description = "Nombre del servicio frontend gestionado por Cloud Build"
  value       = "${var.name_prefix}-frontend"
}

output "load_balancer_url" {
  description = "URL publica del Load Balancer"
  value       = var.domain_name != "" ? "https://${var.domain_name}" : "http://${google_compute_global_address.lb.address}"
}

output "load_balancer_ip" {
  description = "IP publica global del Load Balancer"
  value       = google_compute_global_address.lb.address
}

output "load_balancer_https_enabled" {
  description = "Indica si el Load Balancer tiene HTTPS configurado"
  value       = var.enable_https
}

output "backend_url" {
  description = "Nombre del servicio backend gestionado por Cloud Build"
  value       = "${var.name_prefix}-backend"
}

output "sql_instance_connection_name" {
  description = "Nombre de conexion de Cloud SQL para Cloud Run"
  value       = google_sql_database_instance.db.connection_name
}

output "db_user_secret_name" {
  description = "Nombre del secreto de Secret Manager con la contrasena de la base de datos"
  value       = google_secret_manager_secret.db_password.name
}

output "jwt_secret_name" {
  description = "Nombre del secreto de Secret Manager con la clave JWT del backend"
  value       = google_secret_manager_secret.jwt_secret_key.name
}

output "artifact_registry_repository" {
  description = "Repositorio de Artifact Registry para las imagenes de frontend/backend"
  value       = google_artifact_registry_repository.images.id
}
