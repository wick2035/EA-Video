-- EA-Video Database Initialization Script
-- This runs automatically when the MySQL container starts for the first time

CREATE DATABASE IF NOT EXISTS ea_video CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE ea_video;

-- Patients table
CREATE TABLE IF NOT EXISTS patients (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    uuid CHAR(36) NOT NULL,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) DEFAULT NULL,
    email VARCHAR(100) DEFAULT NULL,
    gender ENUM('male', 'female', 'other') DEFAULT NULL,
    date_of_birth DATE DEFAULT NULL,
    id_number VARCHAR(50) DEFAULT NULL,
    notes TEXT DEFAULT NULL,
    is_active TINYINT(1) DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY idx_patients_uuid (uuid),
    KEY idx_patients_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Doctors table
CREATE TABLE IF NOT EXISTS doctors (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    uuid CHAR(36) NOT NULL,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) DEFAULT NULL,
    email VARCHAR(100) DEFAULT NULL,
    specialty VARCHAR(100) DEFAULT NULL,
    title VARCHAR(50) DEFAULT NULL,
    department VARCHAR(100) DEFAULT NULL,
    max_meeting_duration INT DEFAULT NULL,
    is_online TINYINT(1) DEFAULT 0,
    last_seen_at DATETIME DEFAULT NULL,
    is_active TINYINT(1) DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY idx_doctors_uuid (uuid),
    KEY idx_doctors_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Meetings table (core)
CREATE TABLE IF NOT EXISTS meetings (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    uuid CHAR(36) NOT NULL,
    patient_uuid CHAR(36) NOT NULL,
    doctor_uuid CHAR(36) NOT NULL,
    room_name VARCHAR(100) NOT NULL,
    status ENUM('scheduled', 'waiting', 'in_progress', 'completed', 'cancelled', 'expired') DEFAULT 'scheduled',
    scenario VARCHAR(50) DEFAULT 'general',
    max_duration_minutes INT NOT NULL DEFAULT 30,
    scheduled_at DATETIME DEFAULT NULL,
    actual_start_at DATETIME DEFAULT NULL,
    actual_end_at DATETIME DEFAULT NULL,
    duration_seconds INT DEFAULT NULL,
    end_reason ENUM('normal', 'timeout', 'doctor_left', 'patient_left', 'system', 'error') DEFAULT NULL,
    is_encrypted TINYINT(1) DEFAULT 1,
    notes TEXT DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY idx_meetings_uuid (uuid),
    UNIQUE KEY idx_meetings_room_name (room_name),
    KEY idx_meetings_patient_uuid (patient_uuid),
    KEY idx_meetings_doctor_uuid (doctor_uuid),
    KEY idx_meetings_status (status),
    KEY idx_meetings_doctor_status (doctor_uuid, status),
    KEY idx_meetings_patient_status (patient_uuid, status),
    CONSTRAINT fk_meetings_patient FOREIGN KEY (patient_uuid) REFERENCES patients(uuid) ON DELETE RESTRICT,
    CONSTRAINT fk_meetings_doctor FOREIGN KEY (doctor_uuid) REFERENCES doctors(uuid) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- System configs table
CREATE TABLE IF NOT EXISTS system_configs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    config_key VARCHAR(100) NOT NULL,
    config_value VARCHAR(500) NOT NULL,
    description VARCHAR(255) DEFAULT NULL,
    category VARCHAR(50) DEFAULT 'general',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY idx_system_configs_key (config_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL,
    entity_uuid CHAR(36) DEFAULT NULL,
    action VARCHAR(50) NOT NULL,
    actor_type VARCHAR(20) DEFAULT NULL,
    actor_id VARCHAR(36) DEFAULT NULL,
    details JSON DEFAULT NULL,
    ip_address VARCHAR(45) DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_audit_entity (entity_type, entity_uuid, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- Seed Data
-- ============================================

-- System configs
INSERT INTO system_configs (config_key, config_value, description, category) VALUES
('default_max_duration_minutes', '30', 'Default maximum meeting duration in minutes', 'meeting'),
('scenario_general_duration', '30', 'Duration for general consultation (minutes)', 'meeting'),
('scenario_followup_duration', '15', 'Duration for follow-up consultation (minutes)', 'meeting'),
('scenario_specialist_duration', '45', 'Duration for specialist consultation (minutes)', 'meeting'),
('scenario_emergency_duration', '60', 'Duration for emergency consultation (minutes)', 'meeting'),
('max_concurrent_meetings_per_doctor', '1', 'Max concurrent meetings per doctor', 'meeting'),
('meeting_expiry_minutes', '60', 'Auto-expire meetings not started within this time', 'meeting'),
('jwt_token_expiry_hours', '2', 'JWT token validity in hours', 'security');

-- Sample doctors
INSERT INTO doctors (uuid, name, phone, email, specialty, title, department, is_active) VALUES
('d0000001-0000-0000-0000-000000000001', 'Zhang Wei', '13800000001', 'zhangwei@hospital.com', 'Internal Medicine', 'Chief Physician', 'Internal Medicine', 1),
('d0000002-0000-0000-0000-000000000002', 'Li Na', '13800000002', 'lina@hospital.com', 'Dermatology', 'Associate Chief Physician', 'Dermatology', 1),
('d0000003-0000-0000-0000-000000000003', 'Wang Fang', '13800000003', 'wangfang@hospital.com', 'Pediatrics', 'Attending Physician', 'Pediatrics', 1),
('d0000004-0000-0000-0000-000000000004', 'Chen Ming', '13800000004', 'chenming@hospital.com', 'Cardiology', 'Chief Physician', 'Cardiology', 1),
('d0000005-0000-0000-0000-000000000005', 'Liu Yang', '13800000005', 'liuyang@hospital.com', 'Orthopedics', 'Associate Chief Physician', 'Orthopedics', 1);

-- Sample patients
INSERT INTO patients (uuid, name, phone, email, gender, date_of_birth, is_active) VALUES
('a0000001-0000-0000-0000-000000000001', 'Zhao Lei', '15900000001', 'zhaolei@email.com', 'male', '1990-05-15', 1),
('a0000002-0000-0000-0000-000000000002', 'Sun Li', '15900000002', 'sunli@email.com', 'female', '1985-08-22', 1),
('a0000003-0000-0000-0000-000000000003', 'Zhou Jie', '15900000003', 'zhoujie@email.com', 'male', '1978-12-03', 1),
('a0000004-0000-0000-0000-000000000004', 'Wu Xia', '15900000004', 'wuxia@email.com', 'female', '1995-03-10', 1),
('a0000005-0000-0000-0000-000000000005', 'Huang Tao', '15900000005', 'huangtao@email.com', 'male', '2000-07-28', 1);
