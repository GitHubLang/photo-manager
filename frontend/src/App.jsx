import React, { useState, useEffect } from 'react';
import { Layout, Tree, Input, Card, Row, Col, Spin, Empty, Button, Dropdown, Modal, message, Tabs, Tag, Select, Space, Typography, Image, Divider } from 'antd';
import { FolderOutlined, FileImageOutlined, SearchOutlined, ScanOutlined, SettingOutlined, CameraOutlined, ThunderboltOutlined, EditOutlined, CopyOutlined, CheckOutlined } from '@ant-design/icons';
import './App.css';

const { Sider, Content } = Layout;
const { Search, TextArea } = Input;
const { Title, Text } = Typography;

const API_BASE = 'http://localhost:8000/api';

function App() {
  const [folders, setFolders] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [selectedModel, setSelectedModel] = useState('local');
  const [selectedImage, setSelectedImage] = useState(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [themeModalVisible, setThemeModalVisible] = useState(false);
  const [dailyTheme, setDailyTheme] = useState(null);
  const [captionModalVisible, setCaptionModalVisible] = useState(false);
  const [generatedCaption, setGeneratedCaption] = useState(null);
  const [selectedImages, setSelectedImages] = useState([]);
  const [sortBy, setSortBy] = useState('filename');
  const [sortOrder, setSortOrder] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  // 加载目录树
  useEffect(() => {
    fetchFolders();
  }, []);

  const fetchFolders = async () => {
    try {
      const res = await fetch(`${API_BASE}/folders`);
      const data = await res.json();
      setFolders(data.folders || []);
    } catch (err) {
      message.error('加载目录失败');
    }
  };

  // 扫描所有文件夹
  const handleScanAll = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/folders/scan-all`, { method: 'POST' });
      const data = await res.json();
      message.success(`扫描完成：新增 ${data.added} 张，跳过 ${data.skipped} 张`);
      if (selectedFolder) {
        loadImages(selectedFolder);
      }
      fetchFolders();
    } catch (err) {
      message.error('扫描失败');
    } finally {
      setLoading(false);
    }
  };

  // 加载文件夹图片
  const loadImages = async (folderPath, page = 1, append = false) => {
    if (page === 1) setLoading(true);
    else setLoadingMore(true);
    setSearchResults(null);
    try {
      const params = new URLSearchParams({
        page: page,
        page_size: 50,
        sort_by: sortBy,
        sort_order: sortOrder
      });
      const res = await fetch(`${API_BASE}/folders/${encodeURIComponent(folderPath)}/images?${params}`);
      const data = await res.json();
      
      if (append) {
        setImages(prev => [...prev, ...(data.images || [])]);
      } else {
        setImages(data.images || []);
      }
      setCurrentPage(data.page);
      setTotalPages(data.total_pages);
      setSelectedFolder(folderPath);
    } catch (err) {
      message.error('加载图片失败');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // 加载更多图片（滚动到底部）
  const loadMore = () => {
    if (currentPage < totalPages && !loadingMore) {
      loadImages(selectedFolder, currentPage + 1, true);
    }
  };

  // 搜索图片
  const handleSearch = async (value) => {
    if (!value.trim()) {
      setSearchResults(null);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/search?keyword=${encodeURIComponent(value)}&page=1&page_size=100`);
      const data = await res.json();
      setSearchResults(data.images || []);
    } catch (err) {
      message.error('搜索失败');
    } finally {
      setLoading(false);
    }
  };

  // 评分图片（异步，不等待结果）
  const handleScore = async (imageId) => {
    try {
      const res = await fetch(`${API_BASE}/images/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_ids: [imageId], model: selectedModel })
      });
      const data = await res.json();
      if (data.tasks?.length > 0) {
        message.success('评分任务已创建，请在图片上查看进度');
        // 开始轮询状态
        pollScoreStatus(imageId);
      } else {
        message.error('创建评分任务失败');
      }
    } catch (err) {
      message.error('评分请求失败');
    }
  };

  // 轮询评分状态
  const pollScoreStatus = async (imageId, maxAttempts = 60) => {
    let attempts = 0;
    const poll = async () => {
      if (attempts >= maxAttempts) return;
      attempts++;
      
      try {
        const res = await fetch(`${API_BASE}/images/score/status/${imageId}`);
        const status = await res.json();
        
        if (status.status === 'completed') {
          // 评分完成，刷新图片
          if (selectedFolder) loadImages(selectedFolder);
          return;
        } else if (status.status === 'failed') {
          message.error(`评分失败: ${status.error_message}`);
          return;
        }
        
        // 继续轮询
        setTimeout(poll, 2000);
      } catch (err) {
        // 忽略错误，继续轮询
        setTimeout(poll, 5000);
      }
    };
    
    poll();
  };

  // 批量评分（异步）
  const handleBatchScore = async () => {
    if (selectedImages.length === 0) {
      message.warning('请先选择图片');
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/images/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_ids: selectedImages, model: selectedModel })
      });
      const data = await res.json();
      message.success(`${selectedImages.length} 个评分任务已创建，后台处理中...`);
      
      // 开始轮询所有任务的完成状态
      setSelectedImages([]);
      data.tasks?.forEach(task => {
        pollScoreStatus(task.image_id);
      });
    } catch (err) {
      message.error('批量评分请求失败');
    }
  };

  // 生成每日主题
  const handleGenerateTheme = async () => {
    if (!selectedFolder) return;
    // 从路径提取日期
    const folderName = selectedFolder.split(/[/\\]/).pop();
    if (!folderName.match(/^\d{4}-\d{2}-\d{2}$/)) {
      message.warning('请选择一个日期格式的文件夹');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/daily-theme/${folderName}/generate`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setDailyTheme(data);
        setThemeModalVisible(true);
      } else {
        message.error(data.error || '生成失败');
      }
    } catch (err) {
      message.error('生成主题失败');
    } finally {
      setLoading(false);
    }
  };

  // 生成文案
  const handleGenerateCaption = async (setType) => {
    if (selectedImages.length === 0) {
      message.warning('请先选择图片');
      return;
    }
    const folderName = selectedFolder?.split(/[/\\]/).pop() || '';
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/caption/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          date: folderName, 
          image_ids: selectedImages, 
          set_type: setType 
        })
      });
      const data = await res.json();
      if (data.success) {
        setGeneratedCaption({ ...data.caption, setType });
        setCaptionModalVisible(true);
      } else {
        message.error(data.error || '生成失败');
      }
    } catch (err) {
      message.error('生成文案失败');
    } finally {
      setLoading(false);
    }
  };

  // 目录树数据转换
  const treeData = folders.map(f => ({
    title: (
      <span>
        <FolderOutlined /> {f.name} 
        <Tag style={{ marginLeft: 8 }}>{f.imageCount}</Tag>
      </span>
    ),
    key: f.path,
    path: f.path,
    date: f.date,
    imageCount: f.imageCount
  }));

  // 图片列表（搜索结果或文件夹图片）
  const displayImages = searchResults !== null ? searchResults : images;

  const getScoreColor = (score) => {
    if (score >= 80) return '#52c41a';
    if (score >= 60) return '#1890ff';
    if (score >= 40) return '#faad14';
    return '#f5222d';
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    message.success('已复制到剪贴板');
  };

  return (
    <Layout className="app-layout">
      {/* 顶部工具栏 */}
      <div className="top-toolbar">
        <Title level={4} style={{ margin: 0 }}>
          <CameraOutlined /> 摄影素材管理系统
        </Title>
        <Space>
          <Search 
            placeholder="搜索文件名、描述、标签..." 
            allowClear
            style={{ width: 300 }}
            onSearch={handleSearch}
          />
          <Select 
            value={selectedModel} 
            onChange={setSelectedModel}
            style={{ width: 200 }}
          >
            <Select.Option value="local">本地 Qwen2.5-9B</Select.Option>
            <Select.Option value="minimax">MiniMax Vision</Select.Option>
            <Select.Option value="local-gemma">本地 Gemma-4-E4B-IT</Select.Option>
          </Select>
          <Button icon={<ScanOutlined />} onClick={handleScanAll}>
            扫描
          </Button>
        </Space>
      </div>

      <Layout>
        {/* 左侧目录 */}
        <Sider width={280} className="folder-sider">
          <div className="sider-header">
            <Text strong>文件夹</Text>
          </div>
          <Tree
            treeData={treeData}
            onSelect={(keys, info) => {
              if (info.node.path) {
                loadImages(info.node.path);
                setSelectedImages([]);
              }
            }}
            showIcon={false}
          />
        </Sider>

        {/* 右侧内容 */}
        <Content className="content-area" onScroll={(e) => {
          const { scrollTop, scrollHeight, clientHeight } = e.target;
          if (scrollHeight - scrollTop - clientHeight < 200) {
            loadMore();
          }
        }}>
          {/* 操作栏 */}
          <div className="action-bar">
            <Space>
              <Text>{searchResults ? `搜索结果: ${searchResults.length} 张` : `当前: ${images.length} 张`}{loadingMore && ' (加载更多...)'}</Text>
              {selectedImages.length > 0 && (
                <Tag color="blue">{selectedImages.length} 张已选</Tag>
              )}
            </Space>
            <Space>
              <Select value={sortBy} onChange={(v) => { setSortBy(v); if (selectedFolder) loadImages(selectedFolder, 1); }} style={{ width: 120 }}>
                <Select.Option value="filename">文件名</Select.Option>
                <Select.Option value="total_score">评分</Select.Option>
                <Select.Option value="file_size">大小</Select.Option>
              </Select>
              <Select value={sortOrder} onChange={(v) => { setSortOrder(v); if (selectedFolder) loadImages(selectedFolder, 1); }} style={{ width: 80 }}>
                <Select.Option value="asc">升序</Select.Option>
                <Select.Option value="desc">降序</Select.Option>
              </Select>
              {selectedFolder && (
                <Button icon={<ThunderboltOutlined />} onClick={handleGenerateTheme}>
                  生成主题
                </Button>
              )}
              <Dropdown menu={{
                items: [
                  { key: 'douyin', label: '抖音文案', onClick: () => handleGenerateCaption('douyin') },
                  { key: 'xiaohongshu', label: '小红书文案', onClick: () => handleGenerateCaption('xiaohongshu') }
                ]
              }}>
                <Button disabled={selectedImages.length === 0}>
                  生成文案
                </Button>
              </Dropdown>
              <Button 
                type="primary" 
                icon={<ThunderboltOutlined />}
                disabled={selectedImages.length === 0}
                onClick={handleBatchScore}
              >
                批量评分
              </Button>
            </Space>
          </div>

          {/* 图片网格 */}
          <Spin spinning={loading}>
            {displayImages.length > 0 ? (
              <Row gutter={[16, 16]} className="image-grid">
                {displayImages.map(img => (
                  <Col key={img.id} xs={12} sm={8} md={6} lg={4}>
                    <Card
                      hoverable
                      className={`image-card ${selectedImages.includes(img.id) ? 'selected' : ''}`}
                      cover={
                        <div className="image-cover" onClick={() => {
                          const imageUrl = `${API_BASE}/image/proxy/${encodeURIComponent(img.file_path)}`;
                          setSelectedImage({ ...img, imageUrl });
                          setPreviewVisible(true);
                        }}>
                          <img 
                            src={`${API_BASE}/image/thumbnail/${encodeURIComponent(img.file_path)}?size=400`}
                            alt={img.filename}
                          />
                          <div className="image-score" 
                            style={{ backgroundColor: getScoreColor(img.total_score) }}
                          >
                            {img.total_score ? `⭐ ${img.total_score.toFixed(1)}` : '待评分'}
                          </div>
                          <div className="image-check" 
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedImages(prev => 
                                prev.includes(img.id) 
                                  ? prev.filter(id => id !== img.id)
                                  : [...prev, img.id]
                              );
                            }}
                          >
                            {selectedImages.includes(img.id) ? <CheckOutlined /> : null}
                          </div>
                        </div>
                      }
                      actions={[
                        <EditOutlined key="score" onClick={() => handleScore(img.id)} />,
                      ]}
                    >
                      <Card.Meta 
                        title={<Text ellipsis>{img.filename}</Text>}
                        description={
                          <div>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              {img.width}x{img.height} | {(img.file_size / 1024 / 1024).toFixed(1)}MB
                            </Text>
                            {img.tags && (
                              <div style={{ marginTop: 4 }}>
                                {img.tags.split(',').slice(0, 3).map((tag, i) => (
                                  <Tag key={i} size="small">{tag.trim()}</Tag>
                                ))}
                              </div>
                            )}
                          </div>
                        }
                      />
                    </Card>
                  </Col>
                ))}
              </Row>
            ) : (
              <Empty description={searchResults !== null ? '未找到匹配的图片' : '选择一个文件夹开始'} />
            )}
          </Spin>
        </Content>
      </Layout>

      {/* 图片预览 */}
      <Modal
        open={previewVisible}
        onCancel={() => setPreviewVisible(false)}
        footer={null}
        width={1000}
        centered
      >
        {selectedImage && (
          <div className="image-preview">
            <Image 
              src={selectedImage.imageUrl}
              alt={selectedImage.filename}
              style={{ maxHeight: '50vh', objectFit: 'contain' }}
            />
            <Divider />
            
            {/* 基本信息和评分 */}
            <Row gutter={16}>
              <Col span={8}>
                <Title level={5}>基本信息</Title>
                <p>ID: {selectedImage.id}</p>
                <p>文件名: {selectedImage.filename}</p>
                <p>尺寸: {selectedImage.width}x{selectedImage.height}</p>
                <p>方向: {selectedImage.orientation}</p>
              </Col>
              <Col span={16}>
                <Title level={5}>综合评分: {selectedImage.total_score ? `⭐ ${selectedImage.total_score.toFixed(1)}` : '待评分'}</Title>
                {!selectedImage.total_score && (
                  <Button type="primary" onClick={() => {
                    handleScore(selectedImage.id);
                    setPreviewVisible(false);
                  }}>
                    发起评分
                  </Button>
                )}
              </Col>
            </Row>
            
            {/* 详细评分分析 */}
            {selectedImage.impact_analysis && (
              <>
                <Divider />
                <Title level={5}>📊 详细评分分析</Title>
                <Row gutter={[16, 16]}>
                  {[
                    { key: 'impact', label: '冲击力', weight: '25%' },
                    { key: 'composition', label: '构图', weight: '25%' },
                    { key: 'sharpness', label: '清晰度', weight: '20%' },
                    { key: 'exposure', label: '曝光', weight: '15%' },
                    { key: 'color', label: '色彩', weight: '10%' },
                    { key: 'uniqueness', label: '独特性', weight: '5%' },
                  ].map(dim => (
                    <Col span={12} key={dim.key}>
                      <Card size="small" title={`${dim.label} (${dim.weight})`}>
                        <p><Tag color={selectedImage[`${dim.key}_score`] >= 80 ? 'green' : selectedImage[`${dim.key}_score`] >= 60 ? 'blue' : 'orange'}>
                          分数: {selectedImage[`${dim.key}_score`]?.toFixed(1) || '-'}
                        </Tag></p>
                        <p style={{ fontSize: 12, color: '#666' }}>分析: {selectedImage[`${dim.key}_analysis`] || '-'}</p>
                        {selectedImage[`${dim.key}_suggestion`] && (
                          <p style={{ fontSize: 12, color: '#1890ff' }}>💡 建议: {selectedImage[`${dim.key}_suggestion`]}</p>
                        )}
                      </Card>
                    </Col>
                  ))}
                </Row>
              </>
            )}
            
            {/* 图片描述 */}
            {selectedImage.description && (
              <>
                <Divider />
                <Title level={5}>📝 画面描述</Title>
                <p>{selectedImage.description}</p>
              </>
            )}
            
            {/* 标签 */}
            {selectedImage.tags && (
              <div>
                <Tag color="blue">{selectedImage.tags}</Tag>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* 主题弹窗 */}
      <Modal
        open={themeModalVisible}
        onCancel={() => setThemeModalVisible(false)}
        footer={null}
        width={600}
        title="每日主题"
      >
        {dailyTheme && (
          <div className="theme-content">
            <Title level={3}>{dailyTheme.theme?.theme_title}</Title>
            <p>{dailyTheme.theme?.theme_description}</p>
            <Divider />
            <Space>
              <Tag color="blue">照片数: {dailyTheme.photo_count}</Tag>
              <Tag color="green">平均分: {dailyTheme.avg_score}</Tag>
            </Space>
            <Divider />
            <Text strong>关键词: </Text>
            <span>{dailyTheme.theme?.keywords}</span>
          </div>
        )}
      </Modal>

      {/* 文案弹窗 */}
      <Modal
        open={captionModalVisible}
        onCancel={() => setCaptionModalVisible(false)}
        footer={null}
        width={600}
        title={generatedCaption?.setType === 'douyin' ? '抖音文案' : '小红书文案'}
      >
        {generatedCaption && (
          <div className="caption-content">
            <Title level={4}>{generatedCaption.title}</Title>
            <Divider />
            <p style={{ whiteSpace: 'pre-wrap' }}>
              {generatedCaption.content || generatedCaption.description}
            </p>
            <Divider />
            <div>
              {generatedCaption.hashtags?.split(' ').map((tag, i) => (
                <Tag key={i} color="blue">{tag}</Tag>
              ))}
            </div>
            <Divider />
            <Button 
              icon={<CopyOutlined />} 
              onClick={() => copyToClipboard(
                `${generatedCaption.title}\n\n${generatedCaption.content || generatedCaption.description}\n\n${generatedCaption.hashtags}`
              )}
            >
              复制文案
            </Button>
          </div>
        )}
      </Modal>
    </Layout>
  );
}

export default App;
