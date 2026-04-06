        let mainChartInstance = null;

        // Set brutalist chart defaults
        Chart.defaults.color = '#000000';
        Chart.defaults.font.family = 'Space Mono';
        Chart.defaults.font.weight = 'bold';

        async function fetchData() {
            const login = document.getElementById('streamerSelect').value;
            
            let historyData = null;
            let mlData = null;

            try {
                const histRes = await fetch(`/api/history/${login}`);
                if (histRes.ok) historyData = await histRes.json();
            } catch (e) {
                console.error("History endpoint error:", e);
            }

            try {
                const mlRes = await fetch(`/api/ml/predict/${login}`);
                if (mlRes.ok) mlData = await mlRes.json();
            } catch (e) {
                console.error("ML endpoint error:", e);
            }

            if (historyData) {
                updateDashboard(historyData, mlData);
            }
        }

        function updateDashboard(historyData, mlData) {
            const snapshots = historyData.recent_snapshots || [];
            
            const labels = [];
            const realData = [];
            let lastTime = null;

            snapshots.forEach(s => {
                const d = new Date(s.timestamp);
                labels.push(d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}));
                realData.push(s.viewers);
                lastTime = d;
            });

            // Simulate Sentiment metric
            const lastViewer = realData.length > 0 ? realData[realData.length - 1] : 0;
            if(lastViewer > 0) {
                const sentimentBase = (Math.random() * 0.4 + 0.3);
                const volatility = (Math.random() * 0.15 + 0.05);
                document.getElementById('kpi-predict').innerText = mlData && mlData.status === 'success' ? mlData.predicted_peak.toLocaleString() : "---";
                document.getElementById('kpi-sentiment').innerText = `${sentimentBase.toFixed(2)}`;
                document.getElementById('kpi-sentiment-vol').innerText = `STD DEV: ±${volatility.toFixed(3)}`;
                
                let sBadge = document.getElementById('kpi-sentiment-badge');
                if (sentimentBase > 0.6) {
                    sBadge.className = 'badge growing'; sBadge.innerText = 'EXTREME HYPE';
                } else {
                    sBadge.className = 'badge stable'; sBadge.innerText = 'CASUAL';
                }
            }

            const forecastArr = new Array(realData.length).fill(null);
            const upperArr = new Array(realData.length).fill(null);
            const lowerArr = new Array(realData.length).fill(null);

            if (mlData && mlData.status === 'success') {
                if (realData.length > 0) {
                    forecastArr[realData.length - 1] = realData[realData.length - 1];
                    upperArr[realData.length - 1] = realData[realData.length - 1];
                    lowerArr[realData.length - 1] = realData[realData.length - 1];
                }

                mlData.forecast.forEach(f => {
                    const fd = new Date(lastTime.getTime() + (f.minute_offset * 60000));
                    labels.push(fd.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}));
                    realData.push(null);
                    forecastArr.push(f.predicted_viewers);
                    upperArr.push(f.upper_bound);
                    lowerArr.push(f.lower_bound);
                });

                document.getElementById('kpi-predict').innerText = mlData.predicted_peak.toLocaleString();
                document.getElementById('kpi-error').innerText = `±${Math.round(mlData.model_std_error).toLocaleString()}`;
                
                let tBadge = document.getElementById('kpi-predict-trend');
                tBadge.innerText = mlData.trend.toUpperCase();
                tBadge.className = `badge ${mlData.trend}`;

                const b = document.getElementById('anomalyBanner');
                if (mlData.anomalies_detected) {
                    b.classList.add('active');
                    const lastAnom = mlData.anomalies[mlData.anomalies.length - 1];
                    document.getElementById('anomalyDetails').innerText = `Z=${(lastAnom.z_score).toFixed(2)}`;
                } else {
                    b.classList.remove('active');
                }
            } else {
                document.getElementById('kpi-predict').innerText = 'N/A';
            }

            renderChart(labels, realData, forecastArr, upperArr, lowerArr);
        }

        function renderChart(labels, realData, forecast, upper, lower) {
            const ctx = document.getElementById('mainChart').getContext('2d');
            
            if (mainChartInstance) {
                mainChartInstance.data.labels = labels;
                mainChartInstance.data.datasets[0].data = realData;
                mainChartInstance.data.datasets[1].data = forecast;
                mainChartInstance.data.datasets[2].data = upper;
                mainChartInstance.data.datasets[3].data = lower;
                mainChartInstance.update();
                return;
            }

            mainChartInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: 'Actual',
                            data: realData,
                            borderColor: '#000000',
                            backgroundColor: '#23A094', // Neo-green fill
                            borderWidth: 4,
                            tension: 0, // No smooth curves in brutalism
                            pointRadius: 6,
                            pointBackgroundColor: '#FFC900',
                            pointBorderColor: '#000000',
                            pointBorderWidth: 2,
                            fill: true,
                            stepped: true
                        },
                        {
                            label: 'Predicted',
                            data: forecast,
                            borderColor: '#FF3D71',
                            borderWidth: 4,
                            borderDash: [10, 10],
                            tension: 0,
                            pointRadius: 0,
                            stepped: true
                        },
                        {
                            label: 'Upper Bound',
                            data: upper,
                            borderColor: '#000000',
                            backgroundColor: '#FF90E8', // Pink
                            borderWidth: 2,
                            borderDash: [5, 5],
                            fill: '+1',
                            tension: 0,
                            pointRadius: 0,
                            stepped: true
                        },
                        {
                            label: 'Lower Bound',
                            data: lower,
                            borderColor: '#000000',
                            backgroundColor: 'transparent',
                            borderWidth: 2,
                            borderDash: [5, 5],
                            fill: false,
                            tension: 0,
                            pointRadius: 0,
                            stepped: true
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: {
                        mode: 'index',
                        intersect: false,
                    },
                    plugins: {
                        legend: {
                            labels: {
                                filter: function(item, chart) {
                                    return !item.text.includes('Bound');
                                },
                                usePointStyle: true,
                                boxWidth: 12,
                                font: {
                                    family: 'Space Mono',
                                    weight: 'bold'
                                }
                            }
                        },
                        tooltip: {
                            backgroundColor: '#FFFFFF',
                            titleColor: '#000000',
                            bodyColor: '#000000',
                            titleFont: { size: 14, family: 'Space Mono', weight: 'bold' },
                            bodyFont: { size: 13, family: 'Space Mono', weight: 'bold' },
                            padding: 12,
                            borderColor: '#000000',
                            borderWidth: 3,
                            cornerRadius: 0
                        }
                    },
                    scales: {
                        x: {
                            grid: { color: '#000000', tickLength: 10, lineWidth: 2 },
                            border: { color: '#000000', width: 4 }
                        },
                        y: {
                            grid: { color: '#000000', tickLength: 10, lineWidth: 2 },
                            border: { color: '#000000', width: 4 },
                            beginAtZero: true
                        }
                    }
                }
            });
        }

        fetchData();
        setInterval(fetchData, 30000);
