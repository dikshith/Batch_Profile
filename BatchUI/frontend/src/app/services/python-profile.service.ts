import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ProfileUploadResponse {
  message: string;
  filename: string;
  profile_slot: string;
  session_id: string;
  data: any;
}

export interface ProfilesResponse {
  profiles: {
    [key: string]: {
      filename: string;
      unique_filename: string;
      filepath: string;
      uploaded_at: string;
      data: {
        total_calls: number;
        total_time: number;
        functions: Array<{
          name: string;
          calls: number;
          total_time: number;
          cumulative_time: number;
          per_call: number;
        }>;
      };
    };
  };
  session_info: {
    session_id: string;
    created_at: string;
  };
}

export interface ComparisonResponse {
  session_id: string;
  profiles: Array<{
    filename: string;
    uploaded_at: string;
    total_calls: number;
    total_time: number;
    function_count: number;
  }>;
  comparison: {
    total_time_comparison: number[];
    total_calls_comparison: number[];
    common_functions: Array<{
      name: string;
      profiles: {
        [key: string]: {
          name: string;
          calls: number;
          total_time: number;
          cumulative_time: number;
          per_call: number;
        };
      };
    }>;
    unique_functions: {
      [key: string]: Array<{
        name: string;
        data: {
          name: string;
          calls: number;
          total_time: number;
          cumulative_time: number;
          per_call: number;
        };
      }>;
    };
    performance_metrics: {
      fastest_profile: number;
      slowest_profile: number;
      time_difference: number;
      speedup_factor: number;
    };
  };
}

@Injectable({
  providedIn: 'root'
})
export class PythonProfileService {
  private apiUrl = 'http://localhost:5000/api';
  private headers = new HttpHeaders().set('Content-Type', 'application/json');

  constructor(private http: HttpClient) {}

  uploadProfile(file: File, profileSlot: number): Observable<ProfileUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('profile_slot', profileSlot.toString());

    return this.http.post<ProfileUploadResponse>(`${this.apiUrl}/upload`, formData, {
      withCredentials: true // Important for session handling
    });
  }

  getProfiles(): Observable<ProfilesResponse> {
    return this.http.get<ProfilesResponse>(`${this.apiUrl}/profiles`, {
      headers: this.headers,
      withCredentials: true
    });
  }

  compareProfiles(): Observable<ComparisonResponse> {
    return this.http.post<ComparisonResponse>(`${this.apiUrl}/compare`, {}, {
      headers: this.headers,
      withCredentials: true
    });
  }

  clearProfiles(): Observable<any> {
    return this.http.post(`${this.apiUrl}/clear`, {}, {
      headers: this.headers,
      withCredentials: true
    });
  }

  getSessionInfo(): Observable<any> {
    return this.http.get(`${this.apiUrl}/session-info`, {
      headers: this.headers,
      withCredentials: true
    });
  }

  checkHealth(): Observable<any> {
    return this.http.get(`${this.apiUrl}/health`, {
      headers: this.headers,
      withCredentials: true
    });
  }
}

