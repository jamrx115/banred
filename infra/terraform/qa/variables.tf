variable "project_id" {
  description = "ID del proyecto de Google Cloud donde se desplegara QA"
  type        = string
}

variable "region" {
  description = "Region de despliegue de Cloud Run y Cloud SQL"
  type        = string
  default     = "us-central1"
}

variable "zone" {
  description = "Zona para recursos de GCP que lo requieran"
  type        = string
  default     = "us-central1-a"
}

variable "name_prefix" {
  description = "Prefijo comun para los recursos de QA"
  type        = string
  default     = "banred-qa"
}

variable "frontend_image" {
  description = "Imagen de frontend en Artifact Registry. Si no se define, se usara el repositorio QA"
  type        = string
  default     = ""
}

variable "backend_image" {
  description = "Imagen de backend en Artifact Registry. Si no se define, se usara el repositorio QA"
  type        = string
  default     = ""
}

variable "db_name" {
  description = "Nombre de la base de datos PostgreSQL"
  type        = string
  default     = "banred"
}

variable "db_user" {
  description = "Usuario de la base de datos PostgreSQL"
  type        = string
  default     = "banred_user"
}

variable "db_password_length" {
  description = "Longitud de la contrasena generada para el usuario de la base de datos"
  type        = number
  default     = 24
}

variable "secret_key_length" {
  description = "Longitud de la clave JWT generada para el backend"
  type        = number
  default     = 48
}

variable "cors_origins" {
  description = "Origenes permitidos por CORS. Use * para QA abierto o una lista separada por comas"
  type        = string
  default     = "*"
}

variable "access_token_expire_minutes" {
  description = "Minutos de validez del token JWT"
  type        = number
  default     = 480
}

variable "session_timeout_minutes" {
  description = "Minutos de inactividad antes de expirar la sesion unica"
  type        = number
  default     = 30
}

variable "sql_tier" {
  description = "Tier de Cloud SQL para QA de bajo costo"
  type        = string
  default     = "db-f1-micro"
}

variable "sql_disk_size" {
  description = "Tamano minimo de disco para Cloud SQL en GB"
  type        = number
  default     = 10
}

variable "sql_disk_type" {
  description = "Tipo de disco para Cloud SQL"
  type        = string
  default     = "PD_SSD"
}

variable "cloud_run_cpu" {
  description = "CPU limite para cada servicio de Cloud Run"
  type        = string
  default     = "1"
}

variable "cloud_run_memory" {
  description = "Memoria limite para cada servicio de Cloud Run"
  type        = string
  default     = "256Mi"
}

variable "cloud_run_max_instances" {
  description = "Numero maximo de instancias de Cloud Run para controlar costos"
  type        = number
  default     = 2
}
