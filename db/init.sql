-- Database initialization template for hubstaff_db

CREATE TABLE IF NOT EXISTS system_status (
    id SERIAL PRIMARY KEY,
    service_name VARCHAR(50) NOT NULL UNIQUE,
    status VARCHAR(20) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO system_status (service_name, status)
VALUES 
    ('database', 'healthy'),
    ('backend', 'pending'),
    ('frontend', 'pending')
ON CONFLICT (service_name) DO NOTHING;

CREATE TABLE IF NOT EXISTS activity_logs (
    id SERIAL PRIMARY KEY,
    event VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO activity_logs (event) VALUES ('Database initialized successfully');
