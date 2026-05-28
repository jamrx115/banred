output "frontend_url" {
  description = "URL publica del servicio frontend en Cloud Run"
  value       = google_cloud_run_service.frontend.status[0].url
}

output "load_balancer_url" {
  description = "URL publica HTTP del Load Balancer"
  value       = "http://${google_compute_global_address.lb.address}"
}

output "load_balancer_ip" {
  description = "IP publica global del Load Balancer"
  value       = google_compute_global_address.lb.address
}

output "backend_url" {
  description = "URL publica del servicio backend en Cloud Run"
  value       = google_cloud_run_service.backend.status[0].url
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
