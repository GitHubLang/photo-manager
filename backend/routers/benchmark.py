"""
评分测试 API — 多方案对比
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.benchmark_service import run_benchmark, SCHEMES

router = APIRouter(prefix='/api', tags=['benchmark'])


class BenchmarkRequest(BaseModel):
    image_path: str
    schemes: list[str]


@router.post('/benchmark')
def benchmark(req: BenchmarkRequest):
    """对指定图片运行选中的评分方案"""
    # 校验路径
    if not req.image_path:
        raise HTTPException(status_code=400, detail='image_path 不能为空')
    # 校验方案
    invalid = [s for s in req.schemes if s not in SCHEMES]
    if invalid:
        raise HTTPException(status_code=400, detail=f'未知评分方案: {invalid}')

    results = run_benchmark(req.image_path, req.schemes)
    return {'image_path': req.image_path, 'results': results}


@router.get('/benchmark/schemes')
def list_schemes():
    """列出所有可用评分方案"""
    return {
        'schemes': {k: {'name': v['name']} for k, v in SCHEMES.items()}
    }
