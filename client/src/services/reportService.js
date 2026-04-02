// FILE: client/src/services/reportService.js
import api from './api';

export const getTodayReport = async (elderId) => {
    const { data } = await api.get(`/report/today/${elderId}`);
    return data.report;
};

export const getReportHistory = async (elderId, limit = 14) => {
    const { data } = await api.get(`/report/history/${elderId}?limit=${limit}`);
    return data.reports || [];
};

export const generateReport = async (payload = {}) => {
    const { data } = await api.post('/report/generate', payload);
    return data.report;
};

export const openReportPdf = async (reportId) => {
    const response = await api.get(`/report/pdf/${reportId}`, {
        responseType: 'blob'
    });

    const blob = new Blob([response.data], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener,noreferrer');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
};
