variable "project_id" {
  description = "ID del proyecto de Google Cloud donde se desplegara main"
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
  description = "Prefijo comun para los recursos de main"
  type        = string
  default     = "banred-main"
}

variable "frontend_image" {
  description = "Imagen de frontend en Artifact Registry. Si no se define, se usara el repositorio main"
  type        = string
  default     = ""
}

variable "backend_image" {
  description = "Imagen de backend en Artifact Registry. Si no se define, se usara el repositorio main"
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
  description = "Origenes permitidos por CORS. Use * para main abierto o una lista separada por comas"
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
  description = "Tier de Cloud SQL para main de bajo costo"
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

variable "domain_name" {
  description = "Dominio publico de la aplicacion. Ejemplo: banred.htqasas.com"
  type        = string
  default     = ""
}

variable "enable_https" {
  description = "Habilita HTTPS en el Load Balancer usando certificado origin de Cloudflare"
  type        = bool
  default     = false
}

variable "cloudflare_origin_certificate_path" {
  description = "Ruta local al certificado Origin Certificate de Cloudflare en PEM"
  type        = string
  default     = ""
}

variable "cloudflare_origin_private_key_path" {
  description = "Ruta local a la llave privada del Origin Certificate de Cloudflare en PEM"
  type        = string
  sensitive   = true
  default     = ""
}

variable "cloudflare_ip_ranges" {
  description = "Rangos publicos de Cloudflare permitidos para acceder al Load Balancer"
  type        = list(string)
  default = [
    "173.245.48.0/20",
    "103.21.244.0/22",
    "103.22.200.0/22",
    "103.31.4.0/22",
    "141.101.64.0/18",
    "108.162.192.0/18",
    "190.93.240.0/20",
    "188.114.96.0/20",
    "197.234.240.0/22",
    "198.41.128.0/17",
    "162.158.0.0/15",
    "104.16.0.0/13",
    "104.24.0.0/14",
    "172.64.0.0/13",
    "131.0.72.0/22",
    "2400:cb00::/32",
    "2606:4700::/32",
    "2803:f800::/32",
    "2405:b500::/32",
    "2405:8100::/32",
    "2a06:98c0::/29",
    "2c0f:f248::/32",
  ]
}
